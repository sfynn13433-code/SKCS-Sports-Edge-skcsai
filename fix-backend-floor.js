const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'routes', 'predictions.js');
let code = fs.readFileSync(filePath, 'utf8');

// The replacement: force the backend to always allow the 0-100% matches through
// so the frontend can handle the High Risk UI warnings.
const newCode = code.replace(
    /const enforceEliteFloor = !includeAll\s*&&\s*!isAdminAudit\s*&&\s*planRequiresEliteConfidenceFloor\(planId, planCapabilities\);/g,
    '// SKCS RULE UPDATE: Allow 0-100% 1X2 matches through to trigger UI warnings.\n        const enforceEliteFloor = false; // Disabled by Admin'
);

fs.writeFileSync(filePath, newCode);
console.log('Successfully patched backend/routes/predictions.js');
console.log('The 75% Elite Floor has been removed. 0-100% matches will now flow to the UI.');
