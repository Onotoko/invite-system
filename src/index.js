const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const redis = require('./libs/redis');

let server;

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
    logger.info('Connected to MongoDB');

    // Start server
    server = app.listen(config.port, () => {
        logger.info(`Server listening on port ${config.port}`);
    });
});

// Graceful shutdown
const exitHandler = () => {
    if (server) {
        server.close(() => {
            logger.info('Server closed');
            mongoose.connection.close();
            redis.quit();
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

const unexpectedErrorHandler = (error) => {
    logger.error(error);
    exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    exitHandler();
});
