const fs = require('fs');
const path = require('path');

function walk(dir, depth = 0) {
    let results = [];
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (item === 'node_modules' || item === '.git' || item === '.next') continue;
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                results.push({ type: 'dir', name: item, path: fullPath, depth });
                results.push(...walk(fullPath, depth + 1));
            } else {
                results.push({ type: 'file', name: item, path: fullPath, size: stat.size, depth });
            }
        }
    } catch (e) { }
    return results;
}

const files = walk('C:/Users/skcsa/OneDrive/Desktop/SKCS Things/SKCS-test');
console.log(JSON.stringify(files, null, 2));
