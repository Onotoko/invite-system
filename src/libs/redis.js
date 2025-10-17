const redis = require('redis');
const config = require('../config/config');
const logger = require('../config/logger');

const client = redis.createClient({
    url: config.redis.url,
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused');
            return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }
});

client.on('error', (err) => {
    logger.error('Redis error:', err);
});

client.on('connect', () => {
    logger.info('Connected to Redis');
});

module.exports = client;