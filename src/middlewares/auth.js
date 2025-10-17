const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { STATUS_CODE } = require('../config/response-code');

const auth = (requiredRole) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(STATUS_CODE.UNAUTHORIZED).json({
                hasError: true,
                statusCode: STATUS_CODE.UNAUTHORIZED,
                message: 'Please authenticate',
                data: {}
            });
        }

        try {
            const decoded = jwt.verify(token, config.jwt.secret);

            if (requiredRole && decoded.role !== requiredRole) {
                return res.status(STATUS_CODE.FORBIDDEN).json({
                    hasError: true,
                    statusCode: STATUS_CODE.FORBIDDEN,
                    message: 'Insufficient permissions',
                    data: {}
                });
            }

            req.user = decoded;
            next();
        } catch (error) {
            res.status(STATUS_CODE.UNAUTHORIZED).json({
                hasError: true,
                statusCode: STATUS_CODE.UNAUTHORIZED,
                message: 'Invalid token',
                data: {}
            });
        }
    };
};

module.exports = auth;
