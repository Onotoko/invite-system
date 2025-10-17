const Joi = require('joi');
const config = require('../config/config')


const INVITE_ALPHABET = config.system.invite_alphabet;

// Build regex pattern dynamically based on alphabet
// Format: XXXX-XXXX (4 chars, dash, 4 chars)
const codePattern = new RegExp(`^[${INVITE_ALPHABET}]{4}-[${INVITE_ALPHABET}]{4}$`);

const createInvite = {
    body: Joi.object().keys({
        referrerEmail: Joi.string()
            .email()
            .required()
            .lowercase()
            .trim(),
        maxUses: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(1),
        expiresInDays: Joi.number()
            .integer()
            .min(1)
            .max(365)
            .default(30)
    })
};

const useInvite = {
    body: Joi.object().keys({
        code: Joi.string()
            .required()
            .uppercase()
            .pattern(codePattern)
            .message(`Code must be in format XXXX-XXXX using characters from: ${INVITE_ALPHABET}`),
        email: Joi.string()
            .email()
            .required()
            .lowercase()
            .trim()
    })
};

const validateInvite = {
    params: Joi.object().keys({
        code: Joi.string()
            .required()
            .uppercase()
            .pattern(codePattern)
            .message(`Code must be in format XXXX-XXXX using characters from: ${INVITE_ALPHABET}`)
    })
};

const getInviteStats = {
    query: Joi.object().keys({
        referrerEmail: Joi.string()
            .email()
            .required()
            .lowercase()
            .trim()
    })
};

const getInviteDetails = {
    params: Joi.object().keys({
        code: Joi.string()
            .required()
            .uppercase()
            .pattern(codePattern)
            .message(`Code must be in format XXXX-XXXX using characters from: ${INVITE_ALPHABET}`)
    })
};

module.exports = {
    createInvite,
    useInvite,
    validateInvite,
    getInviteStats,
    getInviteDetails
};