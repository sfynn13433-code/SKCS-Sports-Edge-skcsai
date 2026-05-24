'use strict';

const { exec } = require('child_process');
const path = require('path');

// Define the exact order of execution
const pipelineStages = [
    // Note: Add your ingestion script here if you want it to fetch data first
    // 'node scripts/brute-force-ingest.js', 
    'node scripts/run-stage1-math.js',
    'node scripts/run-stage2-context.js',
    'node scripts/run-stage3-volatility.js',
    'node scripts/run-edgemind-judge.js'
];

console.log("🚀 STARTING SKCS MASTER PIPELINE...");

// Function to run scripts one after the other
function runNextStage(index) {
    if (index >= pipelineStages.length) {
        console.log("\n✅🏁 FULL MASTER PIPELINE COMPLETE. All insights published.");
        return;
    }

    const command = pipelineStages[index];
    console.log(`\n▶️ Executing: ${command}`);

    // Run from project root so relative paths resolve correctly
    const projectRoot = path.resolve(__dirname, '..');

    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error in ${command}:`, error.message);
            // Stop the pipeline if a stage completely fails
            return; 
        }
        
        // Print the output of the script so we can see it in Render logs
        if (stdout) console.log(stdout);
        if (stderr) console.error(`⚠️ Warnings in ${command}:`, stderr);

        // Move to the next stage
        runNextStage(index + 1);
    });
}

// Kick off the first script
runNextStage(0);
