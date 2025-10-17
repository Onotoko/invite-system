const { Router } = require('express');
const inviteController = require('../controllers/invite.controller');
const inviteValidation = require('../validations/invite.validation');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');
const rateLimit = require('../middlewares/rateLimit');

const routes = Router();

// Public routes
routes.post(
    '/use',
    rateLimit.strict, // 5 requests per minute
    validate(inviteValidation.useInvite),
    inviteController.useInvite
);

routes.get(
    '/validate/:code',
    rateLimit.default,
    validate(inviteValidation.validateInvite),
    inviteController.validateInvite
);

// Admin routes
routes.post(
    '/create',
    auth('admin'),
    validate(inviteValidation.createInvite),
    inviteController.createInvite
);

routes.get(
    '/stats',
    auth('admin'),
    validate(inviteValidation.getInviteStats),
    inviteController.getInviteStats
);

routes.get(
    '/details/:code',
    auth('admin'),
    inviteController.getInviteDetails
);

module.exports = routes;