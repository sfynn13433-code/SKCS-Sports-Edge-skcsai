// Express Server with v1 API endpoints for SKCS Master Rulebook
// This file shows how to mount the new v1 routes

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Import existing routes
const predictionsRouter = require('./routes/predictions');
const sportsEdgeRouter = require('./routes/sportsEdge');
const userRouter = require('./routes/user');
const cricketRouter = require('./routes/cricketCount');

// Import new v1 routes
const v1PredictionsRouter = require('./routes/v1/predictions');
const v1AccaRouter = require('./routes/v1/acca');

const app = express();
const PORT = process.env.PORT || 10000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        status: 'rate_limit_exceeded'
    }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
            v1_api: true,
            safe_haven: true,
            correlation_detection: true,
            master_rulebook: true
        }
    });
});

// Mount existing routes (for backward compatibility)
app.use('/api/predictions', predictionsRouter);
app.use('/api/sportsEdge', sportsEdgeRouter);
app.use('/api/user', userRouter);
app.use('/api/cricket', cricketRouter);

// Mount new v1 API routes
app.use('/api/v1', v1PredictionsRouter);
app.use('/api/v1', v1AccaRouter);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'SKCS AI Sports Edge API',
        version: '2.0.0',
        description: 'Sports prediction API with Master Rulebook implementation',
        endpoints: {
            v1: {
                predictions: {
                    'GET /api/v1/matches/:match_id/predictions': 'Get match predictions with Safe Haven fallback',
                    'GET /api/v1/predictions/batch': 'Batch predictions for multiple matches',
                    'GET /api/v1/predictions/history': 'User prediction history'
                },
                acca: {
                    'POST /api/v1/acca/build': 'Build accumulator with correlation validation',
                    'GET /api/v1/acca/history': 'User ACCA history',
                    'GET /api/v1/acca/:acca_id': 'Get ACCA details'
                }
            },
            legacy: {
                'GET /api/predictions': 'Legacy predictions endpoint',
                'GET /api/sportsEdge': 'Legacy sports edge endpoint',
                'GET /api/user/*': 'Legacy user endpoints',
                'GET /api/cricket/*': 'Legacy cricket endpoints'
            }
        },
        features: {
            safe_haven_fallback: 'Automatic fallback to safer markets when main confidence < 80%',
            correlation_detection: 'Prevents accumulator legs with correlation > 0.5',
            risk_tier_classification: 'New 4-tier risk system (75%/55%/30% thresholds)',
            secondary_market_governance: '80% primary, 75% Safe Haven rules',
            database_enforcement: 'Triggers enforce rules at database level'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'Invalid JSON in request body',
            status: 'parse_error'
        });
    }
    
    if (err.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
            error: 'Resource already exists',
            status: 'conflict'
        });
    }
    
    if (err.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
            error: 'Referenced resource not found',
            status: 'reference_error'
        });
    }
    
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: 'error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        status: 'not_found',
        path: req.path,
        method: req.method
    });
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`SKCS AI Sports Edge API Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
        console.log(`Health Check: http://localhost:${PORT}/api/health`);
        console.log('Master Rulebook Features: ENABLED');
    });
}

module.exports = app;
