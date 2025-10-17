const { STATUS_CODE } = require('../config/response-code');
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(err);

    const statusCode = err.statusCode || STATUS_CODE.INTERNAL_SERVER_ERROR;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        hasError: true,
        statusCode,
        message,
        data: {},
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;