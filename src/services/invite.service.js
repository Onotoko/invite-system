const crypto = require('crypto');
const mongoose = require('mongoose');
const Invite = require('../models/invite.model');
const redisClient = require('../libs/redis');
const logger = require('../config/logger');
const config = require('../config/config');

/**
 * Custom Base31 Encoder with Checksum
 * Format: XXXX-XXXX where character at position 4 (index 3) is checksum
 */
class CustomBase31Generator {
    constructor() {
        this.alphabet = config.system.invite_alphabet;
        this.base = this.alphabet.length;

        // System-specific salt for extra uniqueness
        this.salt = config.system.salt;
    }

    /**
     * Generate code with format XXXX-XXXX
     * Position 4 (index 3, last char before dash) is checksum
     */
    generate() {
        // Generate 7 random characters
        const randomChars = this.generateRandomChars(7);

        // Calculate checksum for these 7 characters
        const checksum = this.calculateChecksum(randomChars);

        // Build final code: first 3 chars + checksum + last 4 chars
        // Original 7: ABCDEFG
        // Final 8: ABC[checksum]DEFG
        // Formatted: ABC[checksum]-DEFG
        const code = randomChars.slice(0, 3) + checksum + randomChars.slice(3);

        // Format with dash: XXXX-XXXX
        return `${code.slice(0, 4)}-${code.slice(4)}`;
    }

    /**
     * Generate random characters from alphabet
     */
    generateRandomChars(length) {
        let result = '';
        const bytes = crypto.randomBytes(length * 2); // Extra bytes for better distribution

        for (let i = 0; i < length; i++) {
            // Use modulo to map random byte to alphabet index
            const index = bytes[i] % this.base;
            result += this.alphabet[index];
        }

        return result;
    }

    /**
     * Calculate Luhn-like checksum
     */
    calculateChecksum(str) {
        let sum = 0;

        for (let i = 0; i < str.length; i++) {
            const charValue = this.alphabet.indexOf(str[i]);
            // Alternate weightings: 1, 2, 1, 2, ...
            const weight = (i % 2) + 1;
            sum += charValue * weight;
        }

        // Add salt influence for uniqueness
        for (let i = 0; i < this.salt.length; i++) {
            sum += this.salt.charCodeAt(i);
        }

        return this.alphabet[sum % this.base];
    }

    /**
     * Validate code format and checksum
     * Returns true if valid, false otherwise
     */
    validate(code) {
        // Remove dash and convert to uppercase
        const clean = code.toUpperCase().replace('-', '');

        // Check length
        if (clean.length !== 8) return false;

        // Check all characters are in alphabet
        for (let char of clean) {
            if (!this.alphabet.includes(char)) return false;
        }

        // Extract checksum (position 4, index 3 in clean string)
        const checksum = clean[3];

        // Rebuild original 7 chars (remove checksum at position 4)
        const original = clean.slice(0, 3) + clean.slice(4);

        // Validate checksum
        const expectedChecksum = this.calculateChecksum(original);

        return checksum === expectedChecksum;
    }

    /**
     * Format code for display
     */
    format(code) {
        // Ensure format XXXX-XXXX
        const clean = code.replace('-', '').toUpperCase();
        if (clean.length !== 8) return code;
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
}

class InviteService {
    constructor() {
        this.codeGenerator = new CustomBase31Generator();
    }

    /**
     * Generate secure invite code with validation
     */
    generateCode() {
        return this.codeGenerator.generate();
    }

    /**
     * Validate code format before database lookup
     */
    isValidFormat(code) {
        return this.codeGenerator.validate(code);
    }

    /**
     * Create new invite code
     */
    async createInvite(referrerEmail, maxUses = 1, expiresInDays = 30) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let code;
            let attempts = 0;
            const maxAttempts = 10;

            // Ensure unique code
            while (attempts < maxAttempts) {
                code = this.generateCode();
                const exists = await Invite.findOne({ code });
                if (!exists) break;
                attempts++;
            }

            if (attempts === maxAttempts) {
                throw new Error('Failed to generate unique code');
            }

            const invite = new Invite({
                code,
                referrerEmail,
                maxUses,
                expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            });

            await invite.save({ session });
            await session.commitTransaction();

            // Cache the invite
            await redisClient.setex(
                `invite:${code}`,
                86400, // 24 hours
                JSON.stringify({
                    _id: invite._id.toString(),
                    code: invite.code,
                    referrerEmail: invite.referrerEmail,
                    maxUses: invite.maxUses,
                    currentUses: invite.currentUses,
                    isActive: invite.isActive,
                    expiresAt: invite.expiresAt
                })
            );

            logger.info(`Invite created: ${code} by ${referrerEmail}`);
            return invite;

        } catch (error) {
            await session.abortTransaction();
            logger.error('Create invite error:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Validate and use invite code with distributed lock
     */
    async useInvite(code, userEmail, ipAddress) {
        // Format code properly
        code = code.toUpperCase();

        // First validate format and checksum
        if (!this.isValidFormat(code)) {
            throw new Error('Invalid invite code format or checksum');
        }

        const lockKey = `lock:invite:${code}`;
        const lockTTL = 5000; // 5 seconds
        const lockId = crypto.randomUUID();

        try {
            // Acquire distributed lock
            const acquired = await redisClient.set(
                lockKey,
                lockId,
                'PX',
                lockTTL,
                'NX'
            );

            if (!acquired) {
                throw new Error('Another request is processing this code');
            }

            // Check cache first
            let invite = await this.getFromCache(code);

            if (!invite) {
                invite = await Invite.findOne({ code, isActive: true });
                if (!invite) {
                    throw new Error('Invalid invite code');
                }
            }

            // Validate invite
            if (invite.currentUses >= invite.maxUses) {
                throw new Error('Invite code has reached max uses');
            }

            if (new Date() > new Date(invite.expiresAt)) {
                throw new Error('Invite code has expired');
            }

            // Check if email already used any invite
            const existingUse = await Invite.findOne({
                'usedBy.email': userEmail
            });

            if (existingUse) {
                throw new Error('Email has already used an invite code');
            }

            // Use the invite - atomic update
            const updatedInvite = await Invite.findByIdAndUpdate(
                invite._id || invite.id,
                {
                    $inc: { currentUses: 1 },
                    $push: {
                        usedBy: {
                            email: userEmail,
                            ipAddress,
                            usedAt: new Date()
                        }
                    },
                    $set: {
                        isActive: (invite.currentUses + 1) < invite.maxUses
                    }
                },
                { new: true }
            );

            // Invalidate cache
            await redisClient.del(`invite:${code}`);

            logger.info(`Invite used: ${code} by ${userEmail}`);
            return updatedInvite;

        } finally {
            // Release lock using Lua script for atomicity
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

            try {
                await redisClient.eval(script, 1, lockKey, lockId);
            } catch (err) {
                logger.error('Failed to release lock:', err);
            }
        }
    }

    /**
     * Get invite from cache
     */
    async getFromCache(code) {
        try {
            const cached = await redisClient.get(`invite:${code}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Get invite statistics
     */
    async getInviteStats(referrerEmail) {
        const invites = await Invite.find({ referrerEmail });

        const now = new Date();
        const stats = {
            totalInvites: invites.length,
            totalUses: invites.reduce((sum, inv) => sum + inv.currentUses, 0),
            activeInvites: invites.filter(inv => inv.isActive && new Date(inv.expiresAt) > now).length,
            expiredInvites: invites.filter(inv => new Date(inv.expiresAt) <= now).length,
            fullyUsedInvites: invites.filter(inv => inv.currentUses >= inv.maxUses).length,
            averageUsageRate: invites.length > 0
                ? (invites.reduce((sum, inv) => sum + (inv.currentUses / inv.maxUses), 0) / invites.length * 100).toFixed(2)
                : 0
        };

        return stats;
    }

    /**
     * Validate invite code without using it
     */
    async validateInvite(code) {
        // Format code
        code = code.toUpperCase();

        // Check format first
        if (!this.isValidFormat(code)) {
            return {
                valid: false,
                reason: 'Invalid format or checksum'
            };
        }

        // Check in cache or database
        let invite = await this.getFromCache(code);

        if (!invite) {
            invite = await Invite.findOne({ code });
            if (!invite) {
                return {
                    valid: false,
                    reason: 'Code not found'
                };
            }
        }

        const now = new Date();
        const expiresAt = new Date(invite.expiresAt);

        if (!invite.isActive) {
            return {
                valid: false,
                reason: 'Code is inactive'
            };
        }

        if (invite.currentUses >= invite.maxUses) {
            return {
                valid: false,
                reason: 'Maximum uses reached'
            };
        }

        if (expiresAt <= now) {
            return {
                valid: false,
                reason: 'Code has expired'
            };
        }

        return {
            valid: true,
            remainingUses: invite.maxUses - invite.currentUses,
            expiresAt: invite.expiresAt
        };
    }
}

module.exports = new InviteService();