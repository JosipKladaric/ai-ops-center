/**
 * Agent Roster and Management
 */
import { state, CUSTOM_AGENT_COLORS, nextCustomColorIdx, incrementColorIdx } from './config.js';

export const agents = [
    {
        id: 'team-leader', name: 'Alex', role: 'Director', icon: 'crown',
        systemPrompt: `You are Alex, the Mission Director. You orchestrate the team by managing "mission.md". 
Your workflow:
1. PLAN: Break the mission into Phases and Action items in "mission.md".
2. DELEGATE: Assign one clear task to the best agent. Provide only the necessary context.
3. REVIEW: After each turn, review the worker's output. If they finished, mark [x] in "mission.md". If they are "busy", decide if they should continue.
4. COMPLETE: When all phases are done, declare the mission complete.`,
        history: [], color: '#6366f1', desc: 'Roadmap manager & orchestration director.', enabled: true, builtIn: true
    },
    {
        id: 'programmer', name: 'Codey', role: 'Lead Programmer', icon: 'code',
        systemPrompt: `You are Codey, Lead Programmer. Write complete working code. Use write_file for new source files, edit_file to add to existing ones.`,
        history: [], color: '#10b981', desc: 'Writes complete working code.', enabled: true, builtIn: true
    },
    {
        id: 'designer', name: 'Vidia', role: 'UI Designer', icon: 'palette',
        systemPrompt: `You are Vidia, UI Designer. Create layouts, CSS, UX flows. write_file for new files, edit_file to extend teammates' files.`,
        history: [], color: '#f59e0b', desc: 'Designs UI layouts and styles.', enabled: true, builtIn: true
    },
    {
        id: 'tester', name: 'Buster', role: 'Quality Tester', icon: 'shield-check',
        systemPrompt: `You are Buster, Quality Tester. Review code and design. Set status=needs_review if issues found.`,
        history: [], color: '#ef4444', desc: 'Audits quality and flags issues.', enabled: true, builtIn: true
    },
    {
        id: 'psychologist', name: 'Sigmund', role: 'UX Psychologist', icon: 'brain',
        systemPrompt: `You are Sigmund, UX Psychologist. Apply cognitive principles: visual hierarchy, Fitts law, Gestalt. Be specific and concise.`,
        history: [], color: '#fbbf24', desc: 'Applies psychology to UX decisions.', enabled: true, builtIn: true
    },
    {
        id: 'analyst', name: 'Ana', role: 'Data Analyst', icon: 'bar-chart-2',
        systemPrompt: `You are Ana, Data Analyst. Research, data structures, algorithms, math.`,
        history: [], color: '#8b5cf6', desc: 'Research and data modeling.', enabled: true, builtIn: true
    },
    {
        id: 'copywriter', name: 'Pen', role: 'Copywriter', icon: 'edit-3',
        systemPrompt: `You are Pen, Copywriter. Write READMEs, docstrings, user-facing text. write_file for new docs, edit_file to extend.`,
        history: [], color: '#ec4899', desc: 'Docs, READMEs, and copy.', enabled: true, builtIn: true
    },
    {
        id: 'security', name: 'Locke', role: 'Security Auditor', icon: 'shield',
        systemPrompt: `You are Locke, Security Auditor. Your role is to vet every plan and command for security risks. Ensure code is safe, dependencies are trusted, and commands are whitelisted. Be vigilant and precise.`,
        history: [], color: '#64748b', desc: 'Vets security of plans and code.', enabled: true, builtIn: true
    }
];

export const DEFAULT_PROMPTS = {};
agents.forEach(a => { DEFAULT_PROMPTS[a.id] = a.systemPrompt; });

// Re-expose these globally for the HTML onclick handlers for now, 
// or I'll need to update index.html to use event listeners in a main module.
// Better to follow the user's advice and make it modular properly.
// I'll attach them to window in the main entry point if needed, or better, 
// I'll update the initializers in ui.js.

export function renderAgents() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;
    
    grid.innerHTML = agents.map(agent => {
        const disabledClass = agent.enabled ? '' : ' agent-card-disabled';
        const deleteBtn = agent.builtIn ? '' : `
            <button class="btn-icon agent-delete-btn" style="width:20px;height:20px;" onclick="window.aiTeam.deleteAgent('${agent.id}')" title="Remove agent">
                <i data-lucide="trash-2" style="width:10px;"></i>
            </button>`;
        return `
        <div class="agent-card${disabledClass}" id="card-${agent.id}">
            <div class="agent-compact-row">
                <div class="agent-icon" style="border-color: ${agent.color};">
                    <i data-lucide="${agent.icon}"></i>
                </div>
                <div class="agent-info-primary">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="agent-name" style="color:${agent.color};">${agent.name}</span>
                        <span class="agent-role-tag">${agent.role}</span>
                    </div>
                </div>
                <div class="agent-controls">
                    <span class="agent-status idle" id="status-${agent.id}">IDLE</span>
                    <label class="agent-toggle" title="${agent.enabled ? 'Disable' : 'Enable'} agent">
                        <input type="checkbox" ${agent.enabled ? 'checked' : ''} onchange="window.aiTeam.toggleAgent('${agent.id}', this.checked)">
                        <span class="agent-toggle-slider"></span>
                    </label>
                    <button class="btn-icon" style="width:20px;height:20px;" onclick="window.aiTeam.openPromptEditor('${agent.id}')" title="Edit system prompt">
                        <i data-lucide="edit" style="width:10px;"></i>
                    </button>
                    ${deleteBtn}
                </div>
            </div>
            <div class="agent-compact-desc">
                ${agent.desc}
            </div>
        </div>`;
    }).join('') + `
        <div class="agent-card agent-card-add" id="add-agent-card" onclick="window.aiTeam.openAddAgentModal()" style="display:flex; align-items:center; justify-content:center; padding: 0.5rem; height: auto; min-height: 60px;">
            <div style="display:flex; align-items:center; gap:0.5rem; opacity:0.5;">
                <i data-lucide="plus-circle" style="width:16px; height:16px; color:var(--accent-primary)"></i>
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">Add Agent</span>
            </div>
        </div>`;
    
    if (window.lucide) window.lucide.createIcons();
}

export function toggleAgent(agentId, enabled) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    agent.enabled = enabled;
    renderAgents();
    if (window.aiTeam.saveSession) window.aiTeam.saveSession();
}

export function deleteAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.builtIn) return;
    if (!confirm(`Remove agent "${agent.name}"?`)) return;
    const idx = agents.findIndex(a => a.id === agentId);
    if (idx !== -1) agents.splice(idx, 1);
    renderAgents();
    if (window.aiTeam.saveSession) window.aiTeam.saveSession();
}

export function openAddAgentModal() {
    document.getElementById('new-agent-name').value = '';
    document.getElementById('new-agent-role').value = '';
    document.getElementById('new-agent-desc').value = '';
    document.getElementById('new-agent-prompt').value = '';
    document.getElementById('add-agent-modal').style.display = 'flex';
}

export function saveNewAgent() {
    const name = document.getElementById('new-agent-name').value.trim();
    const role = document.getElementById('new-agent-role').value.trim();
    const desc = document.getElementById('new-agent-desc').value.trim();
    const prompt = document.getElementById('new-agent-prompt').value.trim();
    if (!name || !prompt) { alert('Name and System Prompt are required.'); return; }
    const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const color = CUSTOM_AGENT_COLORS[nextCustomColorIdx % CUSTOM_AGENT_COLORS.length];
    incrementColorIdx();
    agents.push({
        id, name, role: role || 'Custom Agent', icon: 'bot',
        systemPrompt: prompt,
        history: [], color, desc: desc || 'Custom agent.', enabled: true, builtIn: false
    });
    document.getElementById('add-agent-modal').style.display = 'none';
    renderAgents();
    if (window.aiTeam.saveSession) window.aiTeam.saveSession();
}

export function openPromptEditor(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    state.currentEditingAgentId = agentId;
    document.getElementById('modal-agent-name').innerText = `Edit ${agent.name}'s Brain`;
    document.getElementById('modal-prompt-text').value = agent.systemPrompt;
    document.getElementById('prompt-modal').style.display = 'flex';
}
