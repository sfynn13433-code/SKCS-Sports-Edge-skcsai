// DOM Structure Verification Script
// Paste this into DevTools to verify all required containers exist

console.log('=== DOM Structure Verification ===');

// Function to check if element exists and log details
function checkElement(id, description) {
    const element = document.getElementById(id);
    const exists = !!element;
    
    console.log(`${exists ? '✅' : '❌'} ${description}: ${id}`);
    
    if (exists) {
        console.log(`   Tag: ${element.tagName}`);
        console.log(`   Classes: ${element.className}`);
        console.log(`   Visible: ${element.offsetParent !== null}`);
        if (element.innerHTML && element.innerHTML.length < 200) {
            console.log(`   Content: ${element.innerHTML.substring(0, 100)}...`);
        }
    } else {
        console.log(`   ⚠️ Element not found - this could cause rendering failures`);
    }
    
    return exists;
}

// Check all critical DOM elements
const criticalElements = [
    { id: 'skcsMatchDetailModal', desc: 'Match Detail Modal Container' },
    { id: 'ai-confidence-score', desc: 'AI Confidence Score Display' },
    { id: 'ai-confidence-bar', desc: 'AI Confidence Progress Bar' },
    { id: 'edgemind-feedback', desc: 'EdgeMind Feedback Container' },
    { id: 'value-combos', desc: 'Value Combos Container' },
    { id: 'ai-loading-state', desc: 'AI Loading State Container' },
    { id: 'terminal-title', desc: 'Terminal Title' },
    { id: 'terminal-purpose', desc: 'Terminal Purpose' },
    { id: 'terminal-json', desc: 'Terminal JSON Display' },
    { id: 'terminal-stage-badge', desc: 'Terminal Stage Badge' }
];

console.log('🔍 Checking Critical DOM Elements...\n');

let allExists = true;
criticalElements.forEach(({ id, desc }) => {
    const exists = checkElement(id, desc);
    if (!exists) allExists = false;
});

// Check for sports insight containers
console.log('\n🔍 Checking Sports Insight Containers...\n');

const sportsContainers = [
    { id: 'football-matches', desc: 'Football Matches Container' },
    { id: 'cricket-matches', desc: 'Cricket Matches Container' },
    { id: 'tennis-matches', desc: 'Tennis Matches Container' },
    { id: 'basketball-matches', desc: 'Basketball Matches Container' },
    { id: 'accumulators-matches', desc: 'Accumulators Container' }
];

sportsContainers.forEach(({ id, desc }) => {
    checkElement(id, desc);
});

// Check for modal body container
console.log('\n🔍 Checking Modal Structure...\n');
const modalBody = document.getElementById('skcsModalBody');
if (modalBody) {
    console.log('✅ Modal Body Container exists');
    console.log(`   Children count: ${modalBody.children.length}`);
    
    // Check for common modal content structures
    const possibleContent = [
        'skcsModalContent',
        'modal-content',
        'match-detail-content'
    ];
    
    possibleContent.forEach(id => {
        checkElement(id, `Possible Modal Content: ${id}`);
    });
} else {
    console.log('❌ Modal Body Container not found');
    allExists = false;
}

// Summary
console.log('\n📋 DOM Structure Summary:');
console.log(allExists ? '✅ All critical elements found' : '❌ Some elements missing');

if (!allExists) {
    console.log('\n🔧 Recommended Actions:');
    console.log('1. Check if modal HTML structure is properly loaded');
    console.log('2. Verify dynamic content creation in renderMatchDetailModal()');
    console.log('3. Ensure elements are created before AI prediction fetch');
    console.log('4. Add defensive checks in updateModalWithAIData()');
}

// Test modal creation
console.log('\n🧪 Testing Modal Creation...');
if (typeof showMatchDetailModal === 'function') {
    console.log('✅ showMatchDetailModal function exists');
    
    // Check if modal gets created when called
    const existingModal = document.getElementById('skcsMatchDetailModal');
    if (!existingModal) {
        console.log('ℹ️ Modal not currently in DOM - will be created dynamically');
    }
} else {
    console.log('❌ showMatchDetailModal function not found');
}

// Test AI prediction update function
console.log('\n🧪 Testing AI Update Functions...');
if (typeof updateModalWithAIData === 'function') {
    console.log('✅ updateModalWithAIData function exists');
} else {
    console.log('❌ updateModalWithAIData function not found');
}

if (typeof updateModalWithLoadingState === 'function') {
    console.log('✅ updateModalWithLoadingState function exists');
} else {
    console.log('❌ updateModalWithLoadingState function not found');
}

console.log('\n🏁 DOM Verification Complete');
