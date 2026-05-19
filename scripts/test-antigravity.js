#!/usr/bin/env node

/**
 * Test script for Antigravity Workflow Engine
 * Tests the workflow engine functionality and API endpoints
 */

const http = require('http');
const https = require('https');

// Configuration
const DEFAULT_PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${DEFAULT_PORT}`;
const API_BASE = new URL('/api/antigravity', BASE_URL).toString();

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const pathPart = path.startsWith('/') ? path : `/${path}`;
        const finalUrl = API_BASE + pathPart;
        const urlObj = new URL(finalUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        const headers = { 'Content-Type': 'application/json' };
        let bodyStr = null;
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            bodyStr = JSON.stringify(data);
            headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = client.request(urlObj, { method, headers, timeout: 15000 }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(body || '{}');
                    resolve({ status: res.statusCode, data: json });
                } catch (_) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function waitForEngineReady(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await makeRequest('GET', 'status');
            if (r.status === 200 && r.data && r.data.data && r.data.data.engine && r.data.data.engine.initialized) {
                return true;
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
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
        await waitForEngineReady();
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
    const mustHave = ['automated-data-sync'];
    for (const id of mustHave) {
        const found = workflows.some(w => w.id === id);
        if (!found) throw new Error(`Required workflow ${id} not found`);
    }
    console.log('   Required workflows present');
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

// Test 5: Reload Workflows (ensure latest TOML is active before triggering)
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

// Test 6: Get Metrics
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

// Test 7: Trigger Workflow
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

// Test 8: Toggle Workflow
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

// Test 9: Get Executions
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

// Test 10: Get Logs
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

// (Reload already performed earlier)

// Run tests
if (require.main === module) {
    suite.runAll().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = suite;
