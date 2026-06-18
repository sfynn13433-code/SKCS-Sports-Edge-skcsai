// Provides AI reasoning tooltips/display logic
window.attachAIReasoning = function(container, reasoningText) {
    if (!reasoningText) return;
    
    if (container.querySelector('.ai-reasoning-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-reasoning-wrapper';
    wrapper.style.marginTop = '6px';
    wrapper.style.fontSize = '0.75rem';
    wrapper.style.color = '#94a3b8';
    wrapper.style.padding = '6px';
    wrapper.style.background = 'rgba(59, 130, 246, 0.1)';
    wrapper.style.borderLeft = '2px solid #3b82f6';
    wrapper.style.borderRadius = '0 4px 4px 0';
    wrapper.style.display = 'none';
    
    wrapper.innerHTML = `<strong>🧠 EdgeMind:</strong> <span>${reasoningText}</span>`;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '🧠 AI Reasoning';
    toggleBtn.style.fontSize = '0.7rem';
    toggleBtn.style.background = 'none';
    toggleBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    toggleBtn.style.color = '#e2e8f0';
    toggleBtn.style.padding = '2px 6px';
    toggleBtn.style.borderRadius = '4px';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.marginTop = '4px';
    
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        wrapper.style.display = wrapper.style.display === 'none' ? 'block' : 'none';
    };

    container.appendChild(toggleBtn);
    container.appendChild(wrapper);
};
