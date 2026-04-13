'use strict';

// JSON schema - compact to save context window tokens
const JSON_SCHEMA = `
RESPOND WITH ONLY VALID JSON. All fields required:
{
  "thoughts": "brief reasoning",
  "action": "write_file | edit_file | suggest | review | ask",
  "filename": "file.ext (write_file/edit_file only)",
  "content": "write_file=full file. edit_file=new section to append only.",
  "steps": ["Step 1: ...", "Step 2: ..."],
  "status": "complete | needs_review | blocked",
  "message": "short summary of what you did (1-2 sentences)",
  "ask": { "to": "agent-id", "question": "..." }
}
write_file for NEW files only. edit_file to extend an existing file. Always set status and message.`;

// Agent Roster
const CUSTOM_AGENT_COLORS = ['#06b6d4', '#a855f7', '#f43f5e', '#84cc16', '#e879f9', '#fb923c', '#22d3ee', '#facc15'];
let nextCustomColorIdx = 0;

const agents = [
    {
        id: 'team-leader', name: 'Alex', role: 'Team Leader', icon: 'users',
        systemPrompt: `You are Alex, the Project Architect. Plan steps, delegate to your team, and evaluate outcomes.${JSON_SCHEMA}`,
        history: [], color: '#6366f1', desc: 'Plans sprints & evaluates outcomes.', enabled: true, builtIn: true
    },
    {
        id: 'programmer', name: 'Codey', role: 'Lead Programmer', icon: 'code',
        systemPrompt: `You are Codey, Lead Programmer. Write complete working code. Use write_file for new source files, edit_file to add to existing ones.${JSON_SCHEMA}`,
        history: [], color: '#10b981', desc: 'Writes complete working code.', enabled: true, builtIn: true
    },
    {
        id: 'designer', name: 'Vidia', role: 'UI Designer', icon: 'palette',
        systemPrompt: `You are Vidia, UI Designer. Create layouts, CSS, UX flows. write_file for new files, edit_file to extend teammates' files.${JSON_SCHEMA}`,
        history: [], color: '#f59e0b', desc: 'Designs UI layouts and styles.', enabled: true, builtIn: true
    },
    {
        id: 'tester', name: 'Buster', role: 'Quality Tester', icon: 'shield-check',
        systemPrompt: `You are Buster, Quality Tester. Review code and design. Set status=needs_review if issues found.${JSON_SCHEMA}`,
        history: [], color: '#ef4444', desc: 'Audits quality and flags issues.', enabled: true, builtIn: true
    },
    {
        id: 'psychologist', name: 'Sigmund', role: 'UX Psychologist', icon: 'brain',
        systemPrompt: `You are Sigmund, UX Psychologist. Apply cognitive principles: visual hierarchy, Fitts law, Gestalt. Be specific and concise.${JSON_SCHEMA}`,
        history: [], color: '#fbbf24', desc: 'Applies psychology to UX decisions.', enabled: true, builtIn: true
    },
    {
        id: 'analyst', name: 'Ana', role: 'Data Analyst', icon: 'bar-chart-2',
        systemPrompt: `You are Ana, Data Analyst. Research, data structures, algorithms, math.${JSON_SCHEMA}`,
        history: [], color: '#8b5cf6', desc: 'Research and data modeling.', enabled: true, builtIn: true
    },
    {
        id: 'copywriter', name: 'Pen', role: 'Copywriter', icon: 'edit-3',
        systemPrompt: `You are Pen, Copywriter. Write READMEs, docstrings, user-facing text. write_file for new docs, edit_file to extend.${JSON_SCHEMA}`,
        history: [], color: '#ec4899', desc: 'Docs, READMEs, and copy.', enabled: true, builtIn: true
    }
];

// State
let projectFiles = {};
let fileMetadata = {};
let logEntries = [];
let isMissionRunning = false;
let activeDirectoryHandle = null;
let currentEditingAgentId = null;
let activeFilename = null;
let isReadOnly = false;
let activeSessionBackup = null;
let sprintStatuses = [];

// Init
function init() {
    loadSession();
    renderAgents();
    setupEventListeners();
    renderFileTree();
    renderMissionArchive();
}

// Render Agents
function renderAgents() {
    const grid = document.getElementById('team-grid');
    grid.innerHTML = agents.map(agent => {
        const disabledClass = agent.enabled ? '' : ' agent-card-disabled';
        const deleteBtn = agent.builtIn ? '' : `
            <button class="btn-icon agent-delete-btn" style="width:22px;height:22px;" onclick="event.stopPropagation(); deleteAgent('${agent.id}')" title="Remove agent">
                <i data-lucide="trash-2" style="width:10px;"></i>
            </button>`;
        return `
        <div class="agent-card${disabledClass}" id="card-${agent.id}">
            <div class="agent-header">
                <div class="agent-icon" style="border-bottom: 2px solid ${agent.color};">
                    <i data-lucide="${agent.icon}"></i>
                </div>
                <div style="flex-grow:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="agent-role">${agent.role}</span>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <label class="agent-toggle" title="${agent.enabled ? 'Disable' : 'Enable'} agent">
                                <input type="checkbox" ${agent.enabled ? 'checked' : ''} onchange="toggleAgent('${agent.id}', this.checked)">
                                <span class="agent-toggle-slider"></span>
                            </label>
                            <button class="btn-icon" style="width:22px;height:22px;" onclick="openPromptEditor('${agent.id}')" title="Edit system prompt">
                                <i data-lucide="edit" style="width:10px;"></i>
                            </button>
                            ${deleteBtn}
                        </div>
                    </div>
                    <span class="agent-status idle" id="status-${agent.id}">IDLE</span>
                </div>
            </div>
            <div style="font-weight:600; font-size:0.9rem; margin-bottom:0.2rem; color:${agent.color};">${agent.name}</div>
            <p class="agent-desc">${agent.desc}</p>
        </div>`;
    }).join('') + `
        <div class="agent-card agent-card-add" id="add-agent-card" onclick="openAddAgentModal()">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:0.5rem; opacity:0.5;">
                <i data-lucide="plus-circle" style="width:32px; height:32px; color:var(--accent-primary)"></i>
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">Add Agent</span>
            </div>
        </div>`;
    lucide.createIcons();
}

function toggleAgent(agentId, enabled) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    agent.enabled = enabled;
    renderAgents();
    saveSession();
}

function deleteAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.builtIn) return;
    if (!confirm(`Remove agent "${agent.name}"?`)) return;
    const idx = agents.findIndex(a => a.id === agentId);
    if (idx !== -1) agents.splice(idx, 1);
    renderAgents();
    saveSession();
}

function openAddAgentModal() {
    document.getElementById('new-agent-name').value = '';
    document.getElementById('new-agent-role').value = '';
    document.getElementById('new-agent-desc').value = '';
    document.getElementById('new-agent-prompt').value = '';
    document.getElementById('add-agent-modal').style.display = 'flex';
}

function saveNewAgent() {
    const name = document.getElementById('new-agent-name').value.trim();
    const role = document.getElementById('new-agent-role').value.trim();
    const desc = document.getElementById('new-agent-desc').value.trim();
    const prompt = document.getElementById('new-agent-prompt').value.trim();
    if (!name || !prompt) { alert('Name and System Prompt are required.'); return; }
    const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const color = CUSTOM_AGENT_COLORS[nextCustomColorIdx % CUSTOM_AGENT_COLORS.length];
    nextCustomColorIdx++;
    agents.push({
        id, name, role: role || 'Custom Agent', icon: 'bot',
        systemPrompt: prompt + JSON_SCHEMA,
        history: [], color, desc: desc || 'Custom agent.', enabled: true, builtIn: false
    });
    document.getElementById('add-agent-modal').style.display = 'none';
    renderAgents();
    saveSession();
}

function openPromptEditor(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    currentEditingAgentId = agentId;
    document.getElementById('modal-agent-name').innerText = `Edit ${agent.name}'s Brain`;
    document.getElementById('modal-prompt-text').value = agent.systemPrompt;
    document.getElementById('prompt-modal').style.display = 'flex';
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('start-mission').addEventListener('click', () => {
        if (isReadOnly) return;
        const desc = document.getElementById('project-description').value.trim();
        if (desc) startMissionCycle(desc);
    });

    document.getElementById('stop-mission').addEventListener('click', () => {
        isMissionRunning = false;
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('prompt-modal').style.display = 'none';
    });

    document.getElementById('save-prompt').addEventListener('click', () => {
        const agent = agents.find(a => a.id === currentEditingAgentId);
        if (agent) agent.systemPrompt = document.getElementById('modal-prompt-text').value;
        document.getElementById('prompt-modal').style.display = 'none';
        saveSession();
    });

    document.getElementById('reset-session').addEventListener('click', () => {
        if (!confirm('Clear current session data?')) return;
        projectFiles = {};
        fileMetadata = {};
        logEntries = [];
        agents.forEach(a => { a.history = []; });
        document.getElementById('log-feed').innerHTML = '';
        renderFileTree();
        document.getElementById('status-banner').style.display = 'none';
        saveSession();
    });

    document.getElementById('test-connection').addEventListener('click', async () => {
        const el = document.getElementById('connection-status');
        el.style.display = 'block'; el.innerText = 'Testing...'; el.style.color = '';
        try {
            const res = await fetch(`${document.getElementById('server-ip').value}/api/tags`);
            if (res.ok) { el.innerText = 'Connected'; el.style.color = '#10b981'; }
            else throw new Error(`${res.status}`);
        } catch (e) { el.innerText = `Failed (${e.message})`; el.style.color = '#ef4444'; }
    });

    document.getElementById('pick-folder').addEventListener('click', async () => {
        try {
            activeDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            document.getElementById('project-folder').value = activeDirectoryHandle.name;
        } catch { }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (!tabId) return;
            btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.console-tab').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(`${tabId}-tab`);
            if (target) target.classList.add('active');
            if (tabId === 'repo') document.getElementById('workspace-badge').style.display = 'none';
        });
    });

    document.getElementById('download-btn').addEventListener('click', () => {
        if (!activeFilename || !projectFiles[activeFilename]) return;
        const blob = new Blob([projectFiles[activeFilename]], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = activeFilename; a.click();
        URL.revokeObjectURL(url);
    });
}

// Session Persistence
function saveSession() {
    const data = {
        agentData: agents.map(a => ({
            id: a.id, history: a.history, prompt: a.systemPrompt,
            enabled: a.enabled, builtIn: a.builtIn,
            // persist custom agent metadata
            ...(a.builtIn ? {} : { name: a.name, role: a.role, icon: a.icon, color: a.color, desc: a.desc })
        })),
        projectFiles, fileMetadata, logEntries,
        missionScope: document.getElementById('project-description').value,
        serverIp: document.getElementById('server-ip').value,
        modelName: document.getElementById('llm-model').value,
    };
    localStorage.setItem('ai_team_active', JSON.stringify(data));
}

function loadSession() {
    const raw = localStorage.getItem('ai_team_active');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        projectFiles = data.projectFiles || {};
        fileMetadata = data.fileMetadata || {};
        logEntries = data.logEntries || [];
        if (data.missionScope) document.getElementById('project-description').value = data.missionScope;
        if (data.serverIp) document.getElementById('server-ip').value = data.serverIp;
        if (data.modelName) document.getElementById('llm-model').value = data.modelName;
        if (data.agentData) {
            data.agentData.forEach(d => {
                const agent = agents.find(a => a.id === d.id);
                if (agent) {
                    agent.history = d.history || [];
                    agent.systemPrompt = d.prompt || agent.systemPrompt;
                    if (typeof d.enabled === 'boolean') agent.enabled = d.enabled;
                } else if (d.builtIn === false && d.name) {
                    // Re-create custom agent from saved data
                    agents.push({
                        id: d.id, name: d.name, role: d.role || 'Custom Agent',
                        icon: d.icon || 'bot', systemPrompt: d.prompt || '',
                        history: d.history || [], color: d.color || '#06b6d4',
                        desc: d.desc || 'Custom agent.',
                        enabled: typeof d.enabled === 'boolean' ? d.enabled : true,
                        builtIn: false
                    });
                }
            });
        }
        logEntries.forEach(e => renderLogEntry(e.agent, e.msg, e.type, e.time, true));
    } catch { }
}

// Mission Archive
function saveMissionToArchive(title) {
    const id = `mission_${Date.now()}`;
    const index = JSON.parse(localStorage.getItem('ai_team_archive') || '[]');
    index.unshift({ id, title: title.substring(0, 55), time: Date.now() });
    localStorage.setItem('ai_team_archive', JSON.stringify(index.slice(0, 25)));
    localStorage.setItem(`ai_team_${id}`, JSON.stringify({ projectFiles, fileMetadata, logEntries, title }));
    renderMissionArchive();
}

function renderMissionArchive() {
    const el = document.getElementById('mission-archive');
    if (!el) return;
    const index = JSON.parse(localStorage.getItem('ai_team_archive') || '[]');
    if (index.length === 0) {
        el.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No past missions.</div>';
        return;
    }
    el.innerHTML = index.map(m => `
        <div class="archive-item" onclick="loadArchiveMission('${m.id}')">
            <div class="archive-title">${m.title}</div>
            <div class="archive-date">${new Date(m.time).toLocaleDateString()}</div>
        </div>
    `).join('');
}

function loadArchiveMission(id) {
    const raw = localStorage.getItem(`ai_team_${id}`);
    if (!raw) return;
    const data = JSON.parse(raw);
    activeSessionBackup = {
        projectFiles: { ...projectFiles },
        fileMetadata: { ...fileMetadata },
        logEntries: [...logEntries],
        logHtml: document.getElementById('log-feed').innerHTML
    };
    isReadOnly = true;
    document.getElementById('readonly-banner').style.display = 'flex';
    document.getElementById('readonly-title').innerText = data.title || id;
    document.getElementById('start-mission').disabled = true;
    projectFiles = data.projectFiles || {};
    fileMetadata = data.fileMetadata || {};
    document.getElementById('log-feed').innerHTML = '';
    (data.logEntries || []).forEach(e => renderLogEntry(e.agent, e.msg, e.type, e.time, true));
    renderFileTree();
}

function exitReadOnly() {
    isReadOnly = false;
    document.getElementById('readonly-banner').style.display = 'none';
    document.getElementById('start-mission').disabled = false;
    if (activeSessionBackup) {
        projectFiles = activeSessionBackup.projectFiles;
        fileMetadata = activeSessionBackup.fileMetadata || {};
        document.getElementById('log-feed').innerHTML = activeSessionBackup.logHtml;
        renderFileTree();
        activeSessionBackup = null;
    }
}

// File Tree
function renderFileTree() {
    const tree = document.getElementById('file-tree');
    const filenames = Object.keys(projectFiles);
    if (filenames.length === 0) {
        tree.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); font-style:italic; padding: 6px 0;">No files committed.</div>';
        return;
    }
    tree.innerHTML = filenames.map(f => {
        const meta = fileMetadata[f];
        const dot = meta ? `<span class="file-author-dot" style="background:${meta.authorColor}" title="${meta.author}"></span>` : '';
        const mod = meta && meta.modified ? `<span class="file-mod-badge" title="Expanded by ${meta.modified}">+</span>` : '';
        return `
        <div class="file-item ${f === activeFilename ? 'active' : ''}" onclick="selectFile('${f}')">
            <i data-lucide="file-text" style="width:12px; flex-shrink:0;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f}</span>
            ${mod}${dot}
        </div>`;
    }).join('');
    lucide.createIcons();
    if (activeFilename && projectFiles[activeFilename]) {
        document.getElementById('active-filename').innerText = activeFilename;
        document.getElementById('code-content').innerText = projectFiles[activeFilename];
    }
}

function selectFile(filename) {
    activeFilename = filename;
    renderFileTree();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.console-tab').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="repo"]').classList.add('active');
    document.getElementById('repo-tab').classList.add('active');
}

// Logging
function addLog(agentName, message, type) {
    if (!type) type = 'agent';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (!isReadOnly) logEntries.push({ agent: agentName, msg: message, type, time });
    return renderLogEntry(agentName, message, type, time, false);
}

function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))).join('\n');
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
}

function extractStreamMessage(raw) {
    const m = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (m) {
        return m[1].replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return raw.replace(/^\s*\{/, '').replace(/"[\w]+"\s*:/g, '').replace(/[{}"]/g, '').replace(/\\n/g, '\n').trim();
}

function renderLogEntry(agentName, message, type, time, isReplay) {
    const logFeed = document.getElementById('log-feed');
    const div = document.createElement('div');
    const agentObj = agents.find(a => a.name === agentName);
    const color = agentObj ? agentObj.color : (type === 'ask' ? '#f59e0b' : '#6b7280');
    const safeMsg = safeStr(message);

    if (type === 'system') {
        div.className = 'log-system';
        div.innerHTML = '<div class="log-system-pill">' + safeMsg + '</div>';
    } else if (type === 'ask') {
        div.className = 'log-ask';
        div.innerHTML = '<span class="log-ask-time">' + time + '</span>' + safeMsg;
    } else {
        div.className = 'log-card';
        const icon = agentObj ? agentObj.icon : 'user';
        const role = agentObj ? agentObj.role : agentName;
        div.innerHTML =
            '<div class="log-card-header">' +
            '<div class="log-card-avatar" style="background:' + color + '18; border-color:' + color + '55; color:' + color + '">' +
            '<i data-lucide="' + icon + '" style="width:11px;height:11px"></i>' +
            '</div>' +
            '<div class="log-card-meta">' +
            '<span class="log-card-name" style="color:' + color + '">' + agentName.toUpperCase() + '</span>' +
            '<span class="log-card-role">' + role + '</span>' +
            '<span class="log-card-badge-slot"></span>' +
            '</div>' +
            '<span class="log-card-time">' + time + '</span>' +
            '</div>' +
            '<div class="log-card-body">' +
            '<div class="log-body-content">' + marked.parse(safeMsg) + '</div>' +
            '</div>';
    }

    logFeed.prepend(div);
    if (!isReplay) setTimeout(function () { lucide.createIcons(); }, 0);
    return div;
}

// File Commit
async function commitFile(filename, content, authorName, mode) {
    if (!mode) mode = 'write';
    const agentObj = agents.find(a => a.name === authorName);
    const authorColor = agentObj ? agentObj.color : '#6b7280';
    const existing = projectFiles[filename];
    const safeContent = safeStr(content);

    if (mode === 'edit' && existing) {
        const separator = '\n\n# -- Added by ' + authorName + ' --\n';
        projectFiles[filename] = existing + separator + safeContent;
        fileMetadata[filename] = Object.assign({}, fileMetadata[filename], { modified: authorName, modifiedColor: authorColor });
        addLog('System', authorName + ' expanded `' + filename + '`', 'system');
    } else {
        if (existing && safeContent.length < existing.length * 0.6) {
            addLog('System', authorName + ' tried to overwrite `' + filename + '` with shorter content - blocked. Use edit_file.', 'system');
            return;
        }
        projectFiles[filename] = safeContent;
        var wasNew = !existing;
        if (wasNew) {
            fileMetadata[filename] = { author: authorName, authorColor: authorColor, created: Date.now() };
        } else {
            fileMetadata[filename] = Object.assign({}, fileMetadata[filename], { modified: authorName, modifiedColor: authorColor });
        }
        addLog('System', authorName + (wasNew ? ' created' : ' updated') + ' `' + filename + '`', 'system');
    }

    activeFilename = filename;
    renderFileTree();
    document.getElementById('workspace-badge').style.display = 'inline-block';
    if (!isReadOnly) saveSession();

    if (activeDirectoryHandle) {
        try {
            const h = await activeDirectoryHandle.getFileHandle(filename, { create: true });
            const w = await h.createWritable();
            await w.write(projectFiles[filename]);
            await w.close();
        } catch (err) { }
    }
}

// Pipeline Stepper
function renderStepper(steps, currentIdx) {
    document.getElementById('pipeline-stepper').innerHTML = steps.map(function (_, i) {
        var cls = i < currentIdx ? 'completed' : (i === currentIdx ? 'active' : '');
        return '<div class="stepper-item ' + cls + '">' + (i + 1) + '</div>';
    }).join('');
}

// LLM Call
async function callLLM(agent, userPrompt, onChunk) {
    const serverIp = document.getElementById('server-ip').value.trim();
    const model = document.getElementById('llm-model').value.trim();

    const res = await fetch(`${serverIp}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: agent.systemPrompt },
                ...agent.history,
                { role: 'user', content: userPrompt }
            ],
            format: 'json',
            options: {
                temperature: parseFloat(document.getElementById('llm-temp').value) || 0.7,
                num_ctx: 4096
            },
            stream: true
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + errText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let lineBuffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop();
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const j = JSON.parse(line);
                if (j.message && j.message.content) {
                    fullContent += j.message.content;
                    if (onChunk) onChunk(fullContent);
                }
            } catch (e) { }
        }
        if (!isMissionRunning) { reader.cancel(); break; }
    }

    agent.history.push({ role: 'user', content: userPrompt });
    agent.history.push({ role: 'assistant', content: fullContent });
    if (agent.history.length > 12) agent.history = agent.history.slice(-6);

    try {
        return JSON.parse(fullContent);
    } catch (e) {
        const match = fullContent.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) { }
        }
        return { action: 'suggest', status: 'complete', message: fullContent, thoughts: '' };
    }
}

// Agent Turn
async function runAgentTurn(agentId, prompt, statusMsg) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !isMissionRunning) return null;

    const card = document.getElementById('card-' + agent.id);
    const statusLabel = document.getElementById('status-' + agent.id);
    const pipeline = document.getElementById('pipeline-status');

    if (card) card.classList.add('pulse');
    if (statusLabel) { statusLabel.textContent = 'WORKING'; statusLabel.className = 'agent-status'; }
    if (pipeline) pipeline.innerText = agent.role + ': ' + statusMsg;

    let logRef = null;

    try {
        logRef = addLog(agent.name, '\u258c', 'agent');

        const parsed = await callLLM(agent, prompt, function (raw) {
            const cursor = logRef.querySelector('.log-body-content');
            if (!cursor) return;
            cursor.innerHTML = marked.parse(extractStreamMessage(raw) + ' \u258c');
        });

        if (!parsed) return null;

        if (logRef) {
            const body = logRef.querySelector('.log-body-content');
            if (body) body.innerHTML = marked.parse(safeStr(parsed.message || '(no message)'));

            if (parsed.status) {
                const slot = logRef.querySelector('.log-card-badge-slot');
                if (slot) {
                    const sc = parsed.status === 'complete' ? '#10b981' : (parsed.status === 'needs_review' ? '#f59e0b' : '#ef4444');
                    const label = parsed.status.replace('_', ' ').toUpperCase();
                    slot.innerHTML = '<span class="log-status-badge" style="background:' + sc + '22;color:' + sc + '">' + label + '</span>';
                }
            }
        }

        if (parsed.thoughts && logRef) {
            const body = logRef.querySelector('.log-card-body');
            if (body) {
                const t = document.createElement('div');
                t.className = 'log-card-thoughts';
                t.innerText = '\ud83d\udcad ' + safeStr(parsed.thoughts);
                body.appendChild(t);
            }
        }

        if (parsed.action === 'write_file' && parsed.filename && parsed.content) {
            await commitFile(parsed.filename, safeStr(parsed.content), agent.name, 'write');
        }
        if (parsed.action === 'edit_file' && parsed.filename && parsed.content) {
            await commitFile(parsed.filename, safeStr(parsed.content), agent.name, 'edit');
        }

        if (parsed.action === 'ask' && parsed.ask && parsed.ask.to && parsed.ask.question) {
            const target = agents.find(a => a.id === parsed.ask.to);
            if (target) {
                addLog('System', agent.name + ' -> ' + target.name + ': "' + parsed.ask.question + '"', 'ask');
                const answer = await runAgentTurn(parsed.ask.to,
                    agent.name + ' asks: ' + parsed.ask.question + '\nContext: ' + prompt.substring(0, 300),
                    'Answering ' + agent.name + '...'
                );
                if (answer && answer.message) {
                    agent.history.push({ role: 'user', content: target.name + ' replied: ' + safeStr(answer.message) });
                }
            }
        }

        if (parsed.status) sprintStatuses.push(parsed.status);
        return parsed;

    } catch (e) {
        addLog('System', 'Error (' + agent.name + '): ' + e.message, 'system');
        throw e;
    } finally {
        if (card) card.classList.remove('pulse');
        if (statusLabel) { statusLabel.textContent = 'IDLE'; statusLabel.className = 'agent-status idle'; }
    }
}

// Sprint Runner
async function runSprint(steps, roster, planText, mission, sprintNum) {
    const leaderAgent = agents.find(a => a.id === 'team-leader');
    let idx = 0;
    for (const step of steps) {
        if (!isMissionRunning) break;
        renderStepper(steps, idx);
        addLog('System', 'Sprint ' + sprintNum + ' - Step ' + (idx + 1) + ': routing...', 'system');

        const routeLogRef = addLog('Orchestrator', '\u258c', 'agent');
        const getRouteBody = function () { return routeLogRef.querySelector('.log-body-content'); };

        const route = await callLLM(leaderAgent,
            'Which agent ID best handles: "' + step + '"?\nRoster:\n' + roster + '\nJSON: {"agent_id":"id","thoughts":"why","action":"suggest","status":"complete","message":"id"}',
            function (raw) {
                const el = getRouteBody();
                if (el) el.innerHTML = marked.parse(extractStreamMessage(raw) + ' \u258c');
            }
        );

        const rawId = ((route && (route.agent_id || route.message)) || 'programmer').toLowerCase().trim().replace(/[^a-z-]/g, '');
        const agent = agents.find(a => a.id === rawId && a.enabled) || agents.find(a => a.id === 'programmer' && a.enabled) || agents.find(a => a.enabled && a.id !== 'team-leader');

        const rb = getRouteBody();
        if (rb) rb.innerHTML = 'Assigned to <strong style="color:' + agent.color + '">' + agent.name + '</strong> (' + agent.role + ')';

        // Build repo context with file previews (capped to manage token usage)
        const repoContext = Object.keys(projectFiles).length === 0
            ? 'Repository is empty — you will create the first files.'
            : Object.entries(projectFiles).map(([name, content]) => {
                const meta = fileMetadata[name];
                const author = meta?.author ? ` (by ${meta.author}${meta.modified ? `+${meta.modified}` : ''})` : '';
                const preview = content.length > 500 ? content.substring(0, 500) + '\n...' : content;
                return `FILE: ${name}${author}\n\`\`\`\n${preview}\n\`\`\``;
            }).join('\n---\n');

        const githubRule = Object.keys(projectFiles).length > 0
            ? '\nGITHUB: Files above belong to teammates. Use edit_file to add to them. write_file only for brand new files.'
            : '';

        await runAgentTurn(agent.id,
            'MISSION: ' + mission + '\n\nPLAN:\n' + planText + '\n\nYOUR TASK: ' + step + '\n\nREPO:\n' + repoContext + githubRule,
            'Sprint ' + sprintNum + '...'
        );
        idx++;
    }
}

// Status Banner
function showStatusBanner(type, message) {
    const banner = document.getElementById('status-banner');
    banner.innerText = message;
    banner.style.display = 'block';
    const ok = type === 'complete';
    banner.style.background = ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
    banner.style.borderColor = ok ? '#10b981' : '#ef4444';
    banner.style.color = ok ? '#10b981' : '#ef4444';
}

// Mission Lifecycle
async function startMissionCycle(mission) {
    isMissionRunning = true;
    sprintStatuses = [];
    document.getElementById('start-mission').disabled = true;
    document.getElementById('stop-mission').style.display = 'block';
    document.getElementById('status-banner').style.display = 'none';

    const stepCount = Math.max(1, Math.min(8, parseInt(document.getElementById('step-count').value) || 4));
    const enabledAgents = agents.filter(a => a.enabled);
    const roster = enabledAgents.map(a => a.id + ': ' + a.role + ' - ' + a.desc).join('\n');

    addLog('System', 'Mission started - ' + stepCount + ' steps/sprint', 'system');

    try {
        const plan = await runAgentTurn('team-leader',
            `MISSION: "${mission}"

Fill the "steps" array with EXACTLY ${stepCount} development steps.
Each step: "Step N: [concrete task] - Assign to: [Name]"
ONLY use agents from this roster (others are disabled):
Names available: ${enabledAgents.filter(a => a.id !== 'team-leader').map(a => a.name).join(', ')}.
Set action=suggest, status=complete, message="Plan ready".`,
            'Planning sprint 1...'
        );
        if (!plan || !isMissionRunning) throw new Error('Stopped');

        // Primary: use steps array. Fallback: regex-parse message/thoughts.
        let steps = [];
        if (Array.isArray(plan.steps) && plan.steps.length > 0) {
            steps = plan.steps.map(s => safeStr(s)).filter(s => s.length > 5);
        } else {
            const planText = safeStr(plan.message || plan.thoughts || plan.content);
            steps = planText.split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 8 && /(^step\s*\d+|^\d+[.):-]|^[-•*]\s)/i.test(s));
            if (steps.length === 0)
                steps = planText.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 15);
        }

        const planText = Array.isArray(plan.steps) ? plan.steps.join('\n') :
            safeStr(plan.message || plan.thoughts || plan.content);

        await runSprint(steps, roster, planText, mission, 1);
        if (!isMissionRunning) throw new Error('Stopped');

        addLog('System', 'ROUNDTABLE MEETING', 'system');
        const repoSnap = Object.keys(projectFiles).join(', ') || 'none';

        await runAgentTurn('psychologist',
            'Review "' + mission + '". Files: ' + repoSnap + '. Give 3 specific UX/psych improvements.',
            'Psych review...'
        );

        await runAgentTurn('tester',
            'Review "' + mission + '". Files: ' + repoSnap + '. Flag bugs, missing pieces, risks. Set status=needs_review if improvements needed.',
            'Quality audit...'
        );

        const evaluation = await runAgentTurn('team-leader',
            'Sprint 1 complete. Files: ' + repoSnap + '. Statuses: ' + sprintStatuses.join(', ') + '.\nIs mission complete? If follow-up needed, list up to ' + stepCount + ' more steps starting "Step X:" and set status=needs_review. If done, set status=complete.',
            'Sprint evaluation...'
        );
        if (!isMissionRunning) throw new Error('Stopped');

        const needsFollowUp = evaluation && (evaluation.status === 'needs_review' || sprintStatuses.includes('needs_review') || sprintStatuses.includes('blocked'));

        if (needsFollowUp && isMissionRunning) {
            addLog('System', 'FOLLOW-UP SPRINT', 'system');
            sprintStatuses = [];
            const followUpText = safeStr(evaluation?.message);
            let followUpSteps = followUpText.split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 8 && /(^step\s*\d+|^\d+[.):-]|^[-•*]\s)/i.test(s));
            if (followUpSteps.length === 0)
                followUpSteps = followUpText.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 15);
            if (followUpSteps.length > 0) {
                await runSprint(followUpSteps.slice(0, stepCount), roster, followUpText, mission, 2);
            }
            if (isMissionRunning) {
                addLog('System', 'FINAL ROUNDTABLE', 'system');
                await runAgentTurn('tester', 'Final review. Files: ' + Object.keys(projectFiles).join(', ') + '. Mission: ' + mission, 'Final audit...');
                await runAgentTurn('team-leader', 'All sprints complete. Summarize deliverables for "' + mission + '".', 'Final summary...');
            }
        }

        if (isMissionRunning) {
            showStatusBanner('complete', 'Mission Complete');
            saveMissionToArchive(mission);
            saveSession();
        }

    } catch (e) {
        if (e.message !== 'Stopped') addLog('System', 'Mission halted: ' + e.message, 'system');
        showStatusBanner('error', 'Mission Stopped');
    } finally {
        isMissionRunning = false;
        document.getElementById('start-mission').disabled = false;
        document.getElementById('stop-mission').style.display = 'none';
        const ps = document.getElementById('pipeline-status');
        if (ps) ps.innerText = 'Ready...';
    }
}

// Expose globals
window.addEventListener('DOMContentLoaded', init);
window.selectFile = selectFile;
window.openPromptEditor = openPromptEditor;
window.exitReadOnly = exitReadOnly;
window.loadArchiveMission = loadArchiveMission;
window.toggleAgent = toggleAgent;
window.deleteAgent = deleteAgent;
window.openAddAgentModal = openAddAgentModal;
window.saveNewAgent = saveNewAgent;
