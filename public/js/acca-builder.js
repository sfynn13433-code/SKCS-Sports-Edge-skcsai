// Handles building ACCAs via the /api/v1/acca/build endpoint
window.buildAcca = async function(predictionIds) {
    if (!predictionIds || predictionIds.length < 2) {
        alert("Select at least 2 legs to build an ACCA.");
        return;
    }

    try {
        let authHeader = {};
        if (window.supabase) {
            const { data } = await window.supabase.auth.getSession();
            if (data?.session?.access_token) {
                authHeader = { 'Authorization': `Bearer ${data.session.access_token}` };
            }
        }

        const response = await fetch('/api/v1/acca/build', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            body: JSON.stringify({ prediction_ids: predictionIds })
        });

        const data = await response.json();
        
        if (!response.ok) {
            alert(`ACCA Build Failed: ${data.error || 'Unknown error'}`);
            return;
        }

        renderAcca(data);
    } catch (err) {
        console.error("ACCA Builder Error:", err);
        alert("Failed to build ACCA. Check console for details.");
    }
};

window.renderAcca = function(data) {
    const resultsContainer = document.getElementById('acca-results');
    if (!resultsContainer) return;

    let html = `<div style="padding:15px;background:rgba(255,255,255,0.05);border-radius:8px;margin-top:20px;border:1px solid rgba(255,255,255,0.1);">`;
    html += `<h3 style="margin-top:0;color:#e2e8f0;font-size:1rem;margin-bottom:10px;">🏆 ACCA Built Successfully!</h3>`;
    
    const acca = data.acca;
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;font-size:0.85rem;">`;
    html += `<div><strong>Confidence:</strong> <span style="color:#4ade80;">${acca.total_confidence.toFixed(1)}%</span></div>`;
    html += `<div><strong>Odds:</strong> <span style="color:#facc15;">${acca.combined_odds.toFixed(2)}</span></div>`;
    html += `<div><strong>Legs:</strong> ${acca.leg_count}</div>`;
    html += `<div><strong>Risk:</strong> ${acca.risk_assessment?.risk_level || 'Unknown'}</div>`;
    html += `</div>`;

    if (data.leg_composition) {
        html += `<div style="font-size:0.8rem;margin-bottom:15px;color:#94a3b8;">`;
        html += `<strong>Composition:</strong> `;
        const comps = [];
        for (const [tier, count] of Object.entries(data.leg_composition)) {
            comps.push(`${tier.replace('_', ' ').toUpperCase()}: ${count}`);
        }
        html += comps.join(' | ');
        html += `</div>`;
    }

    html += `<div style="font-size:0.8rem;">`;
    data.legs.forEach(leg => {
        html += `<div style="padding:8px;background:rgba(0,0,0,0.2);margin-bottom:6px;border-radius:4px;">`;
        html += `<div style="color:#fff;font-weight:600;margin-bottom:4px;">${leg.fixture.home_team} vs ${leg.fixture.away_team}</div>`;
        html += `<div style="color:#94a3b8;">${leg.market}: <strong style="color:#3b82f6;">${leg.prediction}</strong> (${leg.confidence}%)</div>`;
        html += `</div>`;
    });
    html += `</div></div>`;

    resultsContainer.innerHTML = html;
};
