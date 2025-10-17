const Joi = require('joi');
const { STATUS_CODE } = require('../config/response-code');

const validate = (schema) => {
    return (req, res, next) => {
        const validSchema = {};

        ['params', 'query', 'body'].forEach((key) => {
            if (schema[key]) {
                validSchema[key] = req[key];
            }
        });

        const { error, value } = Joi.compile(schema)
            .prefs({ errors: { label: 'key' } })
            .validate(validSchema);

        if (error) {
            const errorMessage = error.details
                .map((details) => details.message)
                .join(', ');

            return res.status(STATUS_CODE.BAD_REQUEST).json({
                hasError: true,
                statusCode: STATUS_CODE.BAD_REQUEST,
                message: errorMessage,
                data: {}
            });
        }

        Object.assign(req, value);
        return next();
    };
};

module.exports = validate;