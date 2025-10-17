const redis = require('../libs/redis');
const { STATUS_CODE } = require('../config/response-code');

/**
 * Rate limiter using sliding window algorithm
 */
const createRateLimiter = (options) => {
    const {
        windowMs = 60000, // 1 minute
        max = 100, // max requests
        keyPrefix = 'rl'
    } = options;

    return async (req, res, next) => {
        const identifier = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const key = `${keyPrefix}:${identifier}`;
        const now = Date.now();
        const window = now - windowMs;

        try {
            // Remove old entries outside window
            await redis.zremrangebyscore(key, '-inf', window);

            // Count requests in current window
            const count = await redis.zcard(key);

            if (count >= max) {
                return res.status(STATUS_CODE.TOO_MANY_REQUESTS).json({
                    hasError: true,
                    statusCode: STATUS_CODE.TOO_MANY_REQUESTS,
                    message: 'Too many requests, please try again later',
                    data: {
                        retryAfter: Math.ceil(windowMs / 1000)
                    }
                });
            }

            // Add current request
            await redis.zadd(key, now, `${now}-${Math.random()}`);
            await redis.expire(key, Math.ceil(windowMs / 1000));

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', max - count - 1);
            res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            next(); // Fail open
        }
    };
};

module.exports = {
    default: createRateLimiter({ max: 100 }), // 100 req/min
    strict: createRateLimiter({ max: 5 }), // 5 req/min for sensitive endpoints
    auth: createRateLimiter({ max: 10, windowMs: 300000 }) // 10 attempts per 5 min
};
