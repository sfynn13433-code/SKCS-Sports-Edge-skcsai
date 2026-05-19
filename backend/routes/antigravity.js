/**
 * Antigravity Workflow API Routes
 * REST API for managing and monitoring Antigravity workflows
 */

const express = require('express');
const router = express.Router();
const WorkflowEngine = require('../services/antigravity/WorkflowEngine');

// Initialize workflow engine
let workflowEngine = null;

/**
 * Initialize workflow engine on first request
 */
function getWorkflowEngine() {
    if (!workflowEngine) {
        workflowEngine = new WorkflowEngine();
        
        // Setup event listeners for logging
        workflowEngine.on('initialized', (data) => {
            console.log(`🧠 Antigravity initialized with ${data.count} workflows`);
        });
        
        workflowEngine.on('workflowStarted', (execution) => {
            console.log(`🚀 Workflow started: ${execution.workflowId} (${execution.id})`);
        });
        
        workflowEngine.on('workflowCompleted', (execution) => {
            console.log(`✅ Workflow completed: ${execution.workflowId} in ${execution.metrics.duration}ms`);
        });
        
        workflowEngine.on('workflowFailed', (execution) => {
            console.error(`❌ Workflow failed: ${execution.workflowId} - ${execution.error}`);
        });
        
        workflowEngine.on('stepCompleted', (step) => {
            console.log(`📋 Step completed: ${step.name} (${step.duration}ms)`);
        });
        
        workflowEngine.on('stepFailed', (step) => {
            console.error(`❌ Step failed: ${step.name} - ${step.error}`);
        });
    }
    return workflowEngine;
}

/**
 * GET /api/antigravity/status
 * Get overall Antigravity system status
 */
router.get('/status', async (req, res) => {
    try {
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        res.json({
            success: true,
            data: {
                engine: {
                    initialized: status.initialized,
                    totalWorkflows: status.total,
                    runningWorkflows: status.running.length,
                    scheduledWorkflows: status.scheduled.length
                },
                workflows: status.workflows.map(w => ({
                    id: w.id,
                    status: w.status,
                    enabled: w.config.workflow.enabled,
                    lastRun: w.lastRun,
                    nextRun: w.nextRun,
                    runCount: w.runCount,
                    errorCount: w.errorCount
                })),
                running: status.running.map(r => ({
                    id: r.id,
                    workflowId: r.workflowId,
                    trigger: r.trigger,
                    startTime: r.startTime,
                    status: r.status,
                    stepsCompleted: r.metrics.stepsCompleted,
                    stepsTotal: r.metrics.stepsTotal
                }))
            }
        });
    } catch (error) {
        console.error('Antigravity status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/workflows
 * Get all workflows
 */
router.get('/workflows', async (req, res) => {
    try {
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        res.json({
            success: true,
            data: {
                workflows: status.workflows,
                total: status.workflows.length
            }
        });
    } catch (error) {
        console.error('Get workflows error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/workflows/:id
 * Get specific workflow details
 */
router.get('/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus(id);
        
        if (!status.workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Get workflow error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/antigravity/workflows/:id/trigger
 * Manually trigger a workflow
 */
router.post('/workflows/:id/trigger', async (req, res) => {
    try {
        const { id } = req.params;
        const engine = getWorkflowEngine();
        
        // Start workflow execution
        const executionPromise = engine.triggerWorkflow(id);
        
        // Don't wait for completion, return immediately
        res.json({
            success: true,
            message: `Workflow ${id} triggered successfully`,
            data: {
                workflowId: id,
                trigger: 'manual',
                timestamp: new Date()
            }
        });
        
        // Log completion asynchronously
        executionPromise.catch(error => {
            console.error(`Workflow ${id} execution failed:`, error);
        });
        
    } catch (error) {
        console.error('Trigger workflow error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/antigravity/workflows/:id/toggle
 * Enable or disable a workflow
 */
router.put('/workflows/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled must be a boolean'
            });
        }
        
        const engine = getWorkflowEngine();
        const workflow = engine.toggleWorkflow(id, enabled);
        
        res.json({
            success: true,
            message: `Workflow ${id} ${enabled ? 'enabled' : 'disabled'}`,
            data: {
                workflowId: id,
                enabled,
                timestamp: new Date()
            }
        });
        
    } catch (error) {
        console.error('Toggle workflow error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/executions
 * Get recent workflow executions
 */
router.get('/executions', async (req, res) => {
    try {
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        // Get running executions
        const running = status.running.map(r => ({
            id: r.id,
            workflowId: r.workflowId,
            trigger: r.trigger,
            startTime: r.startTime,
            status: r.status,
            stepsCompleted: r.metrics.stepsCompleted,
            stepsTotal: r.metrics.stepsTotal,
            duration: Date.now() - r.startTime.getTime(),
            aiCalls: r.metrics.aiCalls,
            errors: r.metrics.errors
        }));
        
        // Get recent completed workflows
        const recent = status.workflows
            .filter(w => w.lastRun)
            .sort((a, b) => b.lastRun - a.lastRun)
            .slice(0, 10)
            .map(w => ({
                workflowId: w.id,
                lastRun: w.lastRun,
                runCount: w.runCount,
                errorCount: w.errorCount,
                status: w.status
            }));
        
        res.json({
            success: true,
            data: {
                running,
                recent,
                totalRunning: running.length,
                totalRecent: recent.length
            }
        });
    } catch (error) {
        console.error('Get executions error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/metrics
 * Get workflow performance metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        // Calculate metrics
        const totalRuns = status.workflows.reduce((sum, w) => sum + w.runCount, 0);
        const totalErrors = status.workflows.reduce((sum, w) => sum + w.errorCount, 0);
        const successRate = totalRuns > 0 ? ((totalRuns - totalErrors) / totalRuns * 100).toFixed(2) : 0;
        
        // Running workflow metrics
        const runningMetrics = status.running.reduce((acc, r) => ({
            totalAiCalls: acc.totalAiCalls + r.metrics.aiCalls,
            totalSteps: acc.totalSteps + r.metrics.stepsCompleted,
            totalErrors: acc.totalErrors + r.metrics.errors
        }), { totalAiCalls: 0, totalSteps: 0, totalErrors: 0 });
        
        // Workflow health
        const healthyWorkflows = status.workflows.filter(w => w.errorCount === 0).length;
        const workflowHealth = status.workflows.length > 0 ? (healthyWorkflows / status.workflows.length * 100).toFixed(2) : 0;
        
        res.json({
            success: true,
            data: {
                overview: {
                    totalWorkflows: status.workflows.length,
                    runningWorkflows: status.running.length,
                    scheduledWorkflows: status.scheduled.length,
                    totalRuns,
                    totalErrors,
                    successRate: parseFloat(successRate),
                    workflowHealth: parseFloat(workflowHealth)
                },
                running: {
                    count: status.running.length,
                    totalAiCalls: runningMetrics.totalAiCalls,
                    totalSteps: runningMetrics.totalSteps,
                    totalErrors: runningMetrics.totalErrors
                },
                workflows: status.workflows.map(w => ({
                    id: w.id,
                    enabled: w.config.workflow.enabled,
                    runCount: w.runCount,
                    errorCount: w.errorCount,
                    lastRun: w.lastRun,
                    nextRun: w.nextRun,
                    successRate: w.runCount > 0 ? ((w.runCount - w.errorCount) / w.runCount * 100).toFixed(2) : 0
                }))
            }
        });
    } catch (error) {
        console.error('Get metrics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            engine: {
                initialized: status.initialized,
                workflows: status.total,
                running: status.running.length
            },
            dependencies: {
                gemini: !!engine.genAI,
                filesystem: true, // Assume filesystem is accessible
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
        
        // Determine overall health
        if (!status.initialized) {
            health.status = 'degraded';
            health.issues = ['Workflow engine not initialized'];
        }
        
        if (status.running.length > 5) {
            health.status = 'warning';
            health.issues = ['High number of running workflows'];
        }
        
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 503 : 200;
        
        res.status(statusCode).json({
            success: health.status === 'healthy',
            data: health
        });
        
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            success: false,
            error: error.message,
            status: 'unhealthy'
        });
    }
});

/**
 * POST /api/antigravity/reload
 * Reload workflow configurations
 */
router.post('/reload', async (req, res) => {
    try {
        console.log('🔄 Reloading Antigravity workflows...');
        
        // Create new engine instance
        workflowEngine = null;
        const engine = getWorkflowEngine();
        
        // Wait a moment for initialization
        setTimeout(() => {
            const status = engine.getWorkflowStatus();
            console.log(`✅ Reloaded ${status.total} workflows`);
        }, 1000);
        
        res.json({
            success: true,
            message: 'Workflows reloaded successfully',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Reload workflows error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/antigravity/logs
 * Get recent workflow logs (simplified)
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50, level = 'all' } = req.query;
        
        // In a real implementation, this would read from a log file or database
        // For now, return recent workflow activity
        const engine = getWorkflowEngine();
        const status = engine.getWorkflowStatus();
        
        const logs = [];
        
        // Add recent workflow runs as logs
        status.workflows
            .filter(w => w.lastRun)
            .sort((a, b) => b.lastRun - a.lastRun)
            .slice(0, parseInt(limit))
            .forEach(w => {
                logs.push({
                    timestamp: w.lastRun,
                    level: w.errorCount > 0 ? 'error' : 'info',
                    workflow: w.id,
                    message: `Workflow ${w.id} ${w.errorCount > 0 ? 'completed with errors' : 'completed successfully'}`,
                    metadata: {
                        runCount: w.runCount,
                        errorCount: w.errorCount
                    }
                });
            });
        
        res.json({
            success: true,
            data: {
                logs,
                total: logs.length,
                filtered: level !== 'all' ? logs.filter(l => l.level === level) : logs
            }
        });
        
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
