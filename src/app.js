const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config/config');
const logger = require('./config/logger');
const inviteRoutes = require('./routes/invite.route');
const errorHandler = require('./middlewares/error');

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// API routes
app.use('/api/invite', inviteRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        hasError: true,
        statusCode: 404,
        message: 'Not found',
        data: {}
    });
});

// Error handler
app.use(errorHandler);

module.exports = app;