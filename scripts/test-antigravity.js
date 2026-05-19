#!/usr/bin/env node

/**
 * Test script for Antigravity Workflow Engine
 * Tests the workflow engine functionality and API endpoints
 */

const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:10000';
const API_BASE = `${BASE_URL}/api/antigravity`;

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

/**
 * Test suite
 */
class AntigravityTestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runTest(test) {
        try {
            console.log(`🧪 Running test: ${test.name}`);
            await test.testFn();
            console.log(`✅ Test passed: ${test.name}`);
            this.passed++;
        } catch (error) {
            console.error(`❌ Test failed: ${test.name} - ${error.message}`);
            this.failed++;
        }
    }

    async runAll() {
        console.log('🚀 Starting Antigravity Workflow Engine Tests...\n');

        for (const test of this.tests) {
            await this.runTest(test);
            console.log(''); // Add spacing
        }

        console.log('📊 Test Results:');
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(2)}%`);

        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// Create test suite
const suite = new AntigravityTestSuite();

// Test 1: Health Check
suite.addTest('Health Check', async () => {
    const response = await makeRequest('GET', '/health');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Health check returned failure');
    }
    
    console.log(`   Status: ${response.data.data.status}`);
    console.log(`   Workflows: ${response.data.data.engine.workflows}`);
});

// Test 2: System Status
suite.addTest('System Status', async () => {
    const response = await makeRequest('GET', '/status');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Status check returned failure');
    }
    
    const data = response.data.data;
    console.log(`   Engine initialized: ${data.engine.initialized}`);
    console.log(`   Total workflows: ${data.engine.totalWorkflows}`);
    console.log(`   Running workflows: ${data.engine.runningWorkflows}`);
});

// Test 3: List Workflows
suite.addTest('List Workflows', async () => {
    const response = await makeRequest('GET', '/workflows');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Workflows list returned failure');
    }
    
    const workflows = response.data.data.workflows;
    console.log(`   Found ${workflows.length} workflows`);
    
    // Check for expected workflows
    const expectedWorkflows = [
        'automated-data-sync',
        'intelligent-pipeline-optimizer',
        'smart-prediction-engine',
        'intelligent-alert-system'
    ];
    
    for (const expected of expectedWorkflows) {
        const found = workflows.some(w => w.id === expected);
        if (!found) {
            throw new Error(`Expected workflow ${expected} not found`);
        }
    }
    
    console.log('   All expected workflows found');
});

// Test 4: Get Specific Workflow
suite.addTest('Get Specific Workflow', async () => {
    const response = await makeRequest('GET', '/workflows/automated-data-sync');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Workflow detail returned failure');
    }
    
    const workflow = response.data.data.workflow;
    console.log(`   Workflow: ${workflow.id}`);
    console.log(`   Enabled: ${workflow.config.workflow.enabled}`);
    console.log(`   Version: ${workflow.config.workflow.version}`);
});

// Test 5: Get Metrics
suite.addTest('Get Metrics', async () => {
    const response = await makeRequest('GET', '/metrics');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Metrics returned failure');
    }
    
    const metrics = response.data.data;
    console.log(`   Total workflows: ${metrics.overview.totalWorkflows}`);
    console.log(`   Success rate: ${metrics.overview.successRate}%`);
    console.log(`   Workflow health: ${metrics.overview.workflowHealth}%`);
});

// Test 6: Trigger Workflow
suite.addTest('Trigger Workflow', async () => {
    const response = await makeRequest('POST', '/workflows/automated-data-sync/trigger');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Workflow trigger returned failure');
    }
    
    console.log(`   Workflow triggered: ${response.data.data.workflowId}`);
    console.log(`   Trigger type: ${response.data.data.trigger}`);
});

// Test 7: Toggle Workflow
suite.addTest('Toggle Workflow', async () => {
    // First disable
    let response = await makeRequest('PUT', '/workflows/automated-data-sync/toggle', { enabled: false });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Workflow disable returned failure');
    }
    
    console.log(`   Workflow disabled`);
    
    // Then re-enable
    response = await makeRequest('PUT', '/workflows/automated-data-sync/toggle', { enabled: true });
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Workflow enable returned failure');
    }
    
    console.log(`   Workflow re-enabled`);
});

// Test 8: Get Executions
suite.addTest('Get Executions', async () => {
    const response = await makeRequest('GET', '/executions');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Executions list returned failure');
    }
    
    const executions = response.data.data;
    console.log(`   Running executions: ${executions.totalRunning}`);
    console.log(`   Recent executions: ${executions.totalRecent}`);
});

// Test 9: Get Logs
suite.addTest('Get Logs', async () => {
    const response = await makeRequest('GET', '/logs?limit=10');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Logs returned failure');
    }
    
    const logs = response.data.data.logs;
    console.log(`   Retrieved ${logs.length} log entries`);
});

// Test 10: Reload Workflows
suite.addTest('Reload Workflows', async () => {
    const response = await makeRequest('POST', '/reload');
    
    if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
        throw new Error('Reload returned failure');
    }
    
    console.log(`   Workflows reloaded successfully`);
});

// Run tests
if (require.main === module) {
    suite.runAll().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = suite;
