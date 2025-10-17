const inviteService = require('../services/invite.service');
const Invite = require('../models/invite.model');
const { STATUS_CODE } = require('../config/response-code');
const catchAsync = require('../utils/catchAsync');

const inviteController = {
    /**
     * Create new invite code
     */
    createInvite: catchAsync(async (req, res) => {
        const { referrerEmail, maxUses, expiresInDays } = req.body;

        const invite = await inviteService.createInvite(
            referrerEmail,
            maxUses,
            expiresInDays
        );

        res.status(STATUS_CODE.OK).json({
            hasError: false,
            statusCode: STATUS_CODE.OK,
            message: 'Invite code created successfully',
            data: {
                code: invite.code,
                maxUses: invite.maxUses,
                expiresAt: invite.expiresAt
            }
        });
    }),

    /**
     * Use invite code
     */
    useInvite: catchAsync(async (req, res) => {
        const { code, email } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'];

        const result = await inviteService.useInvite(code, email, ipAddress);

        res.status(STATUS_CODE.OK).json({
            hasError: false,
            statusCode: STATUS_CODE.OK,
            message: 'Invite code validated successfully',
            data: {
                success: true,
                referrer: result.referrerEmail
            }
        });
    }),

    /**
     * Validate invite code without using it
     */
    validateInvite: catchAsync(async (req, res) => {
        const { code } = req.params;

        const invite = await Invite.findOne({ code, isActive: true });

        if (!invite) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                hasError: true,
                statusCode: STATUS_CODE.BAD_REQUEST,
                message: 'Invalid invite code',
                data: {}
            });
        }

        const isValid = invite.currentUses < invite.maxUses &&
            new Date() < invite.expiresAt;

        res.status(STATUS_CODE.OK).json({
            hasError: false,
            statusCode: STATUS_CODE.OK,
            message: 'Invite code validation',
            data: {
                valid: isValid,
                remainingUses: invite.maxUses - invite.currentUses,
                expiresAt: invite.expiresAt
            }
        });
    }),

    /**
     * Get invite statistics
     */
    getInviteStats: catchAsync(async (req, res) => {
        const { referrerEmail } = req.query;

        const stats = await inviteService.getInviteStats(referrerEmail);

        res.status(STATUS_CODE.OK).json({
            hasError: false,
            statusCode: STATUS_CODE.OK,
            message: 'Invite statistics retrieved',
            data: stats
        });
    }),

    /**
     * Get invite details (admin)
     */
    getInviteDetails: catchAsync(async (req, res) => {
        const { code } = req.params;

        const invite = await Invite.findOne({ code });

        if (!invite) {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                hasError: true,
                statusCode: STATUS_CODE.NOT_FOUND,
                message: 'Invite code not found',
                data: {}
            });
        }

        res.status(STATUS_CODE.OK).json({
            hasError: false,
            statusCode: STATUS_CODE.OK,
            message: 'Invite details retrieved',
            data: invite
        });
    })
};

module.exports = inviteController;