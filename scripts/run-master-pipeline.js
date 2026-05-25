const { exec } = require('child_process');
const path = require('path');

// 1. Get the target sport from the webhook/cron
const args = process.argv.slice(2);
const sportArgIndex = args.indexOf('--sport');
const targetSport = sportArgIndex !== -1 ? args[sportArgIndex + 1].toLowerCase() : 'football';

// 2. Pass the flag to every stage
const pipelineStages = [
    `node scripts/run-stage1-math.js --sport ${targetSport}`,
    `node scripts/run-stage2-context.js --sport ${targetSport}`,
    `node scripts/run-stage3-volatility.js --sport ${targetSport}`,
    `node scripts/run-edgemind-judge.js --sport ${targetSport}`
];

console.log(`🚀 STARTING SKCS MASTER PIPELINE [${targetSport.toUpperCase()}]...`);

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
