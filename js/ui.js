/**
 * UI Rendering & Interactivity
 */
import { state, incrementColorIdx, CUSTOM_AGENT_COLORS } from './config.js';
import { agents, renderAgents } from './agents.js';

export function renderFileTree() {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    const filenames = Object.keys(state.projectFiles);
    if (filenames.length === 0) {
        tree.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); font-style:italic; padding: 6px 0;">No files committed.</div>';
        return;
    }
    tree.innerHTML = filenames.map(f => {
        const meta = state.fileMetadata[f];
        const dot = meta ? `<span class="file-author-dot" style="background:${meta.authorColor}" title="${meta.author}"></span>` : '';
        const mod = meta && meta.modified ? `<span class="file-mod-badge" title="Expanded by ${meta.modified}">+</span>` : '';
        return `
        <div class="file-item ${f === state.activeFilename ? 'active' : ''}" onclick="window.aiTeam.selectFile('${f}')">
            <i data-lucide="file-text" style="width:12px; flex-shrink:0;"></i>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f}</span>
            ${mod}${dot}
        </div>`;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
    
    if (state.activeFilename && state.projectFiles[state.activeFilename]) {
        const fnDisplay = document.getElementById('active-filename');
        const codeDisplay = document.getElementById('code-content');
        if (fnDisplay) fnDisplay.innerText = state.activeFilename;
        if (codeDisplay) {
            codeDisplay.innerText = state.projectFiles[state.activeFilename];
            // Remove previous highlighting class and re-highlight
            codeDisplay.className = '';
            if (window.hljs) window.hljs.highlightElement(codeDisplay);
        }
    }
}

export async function selectFile(filename) {
    state.activeFilename = filename;
    renderFileTree();
    
    if (filename === 'mission.md') {
        renderMissionCanvas();
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.console-tab').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="repo"]').classList.add('active');
    document.getElementById('repo-tab').classList.add('active');
    const badge = document.getElementById('workspace-badge');
    if (badge) badge.style.display = 'none';
}

export function addLog(agentName, message, type = 'log') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!state.isReadOnly) state.logEntries.push({ agent: agentName, msg: message, type, time });
    return renderLogEntry(agentName, message, type, time, false);
}

export function renderLogEntry(agentName, message, type, time, isReplay) {
    const logFeed = document.getElementById('log-feed');
    if (!logFeed) return;
    const div = document.createElement('div');
    const agentObj = agents.find(a => a.name === agentName);
    const color = agentObj ? agentObj.color : (type === 'ask' ? '#f59e0b' : '#6b7280');
    const safeMsg = typeof message === 'string' ? message : JSON.stringify(message);

    if (type === 'system') {
        div.className = 'log-system';
        div.innerHTML = `<div class="log-system-pill">${safeMsg}</div>`;
    } else if (type === 'ask') {
        div.className = 'log-ask';
        div.innerHTML = `<span class="log-ask-time">${time}</span>${safeMsg}`;
    } else {
        div.className = 'log-card';
        const icon = agentObj ? agentObj.icon : 'user';
        const role = agentObj ? agentObj.role : agentName;
        div.innerHTML = `
            <div class="log-card-header">
                <div class="log-card-avatar" style="background:${color}18; border-color:${color}55; color:${color}">
                    <i data-lucide="${icon}" style="width:11px;height:11px"></i>
                </div>
                <div class="log-card-meta">
                    <span class="log-card-name" style="color:${color}">${agentName.toUpperCase()}</span>
                    <span class="log-card-role">${role}</span>
                    <span class="log-card-badge-slot"></span>
                </div>
                <span class="log-card-time">${time}</span>
            </div>
            <div class="log-card-body">
                <div class="log-body-content">${window.marked.parse(safeMsg)}</div>
            </div>`;
    }

    logFeed.prepend(div);
    if (!isReplay) setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 0);
    return div;
}

export function renderStepper(steps, currentIdx) {
    const stepper = document.getElementById('pipeline-stepper');
    if (!stepper) return;
    stepper.innerHTML = steps.map((s, i) => {
        const cls = i < currentIdx ? 'completed' : (i === currentIdx ? 'active' : '');
        const stepName = s.split(':')[1]?.trim() || s;
        return `<div class="stepper-item ${cls}" title="${s}">
            <div style="font-size:0.6rem; opacity:0.6; margin-bottom:2px;">STEP ${i+1}</div>
            <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${stepName}</div>
        </div>`;
    }).join('');
}

export function showStatusBanner(type, message) {
    const banner = document.getElementById('status-banner');
    if (!banner) return;
    banner.innerText = message;
    banner.style.display = 'block';
    const ok = type === 'complete';
    banner.style.background = ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
    banner.style.borderColor = ok ? '#10b981' : '#ef4444';
    banner.style.color = ok ? '#10b981' : '#ef4444';
}

export function saveSession() {
    const data = {
        agentData: agents.map(a => ({
            id: a.id, history: a.history, prompt: a.systemPrompt,
            enabled: a.enabled, builtIn: a.builtIn,
            ...(a.builtIn ? {} : { name: a.name, role: a.role, icon: a.icon, color: a.color, desc: a.desc })
        })),
        projectFiles: state.projectFiles,
        fileMetadata: state.fileMetadata,
        logEntries: state.logEntries,
        missionScope: document.getElementById('project-description')?.value,
        serverIp: document.getElementById('server-ip')?.value,
        modelName: document.getElementById('llm-model')?.value,
        communicationRules: state.communicationRules,
        useThinking: document.getElementById('llm-think')?.checked,
        projectName: state.projectName,
    };
    localStorage.setItem('ai_team_active', JSON.stringify(data));
}

export function loadSession(communicationRules, setCommunicationRules) {
    const raw = localStorage.getItem('ai_team_active');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        state.projectFiles = data.projectFiles || {};
        state.fileMetadata = data.fileMetadata || {};
        state.logEntries = data.logEntries || [];
        const descInput = document.getElementById('project-description');
        if (data.missionScope && descInput) descInput.value = data.missionScope;

        const serverInput = document.getElementById('server-ip');
        if (data.serverIp && serverInput) serverInput.value = data.serverIp;

        const modelInput = document.getElementById('llm-model');
        if (data.modelName && modelInput) modelInput.value = data.modelName;

        if (data.projectName) {
            state.projectName = data.projectName;
            const projInput = document.getElementById('project-name');
            if (projInput) projInput.value = state.projectName;
        }

        const thinkCheck = document.getElementById('llm-think');
        if (data.hasOwnProperty('useThinking') && thinkCheck) thinkCheck.checked = data.useThinking;
        if (data.agentData) {
            data.agentData.forEach(d => {
                const agent = agents.find(a => a.id === d.id);
                if (agent) {
                    agent.history = d.history || [];
                    agent.systemPrompt = d.prompt || agent.systemPrompt;
                    if (typeof d.enabled === 'boolean') agent.enabled = d.enabled;
                } else if (d.builtIn === false && d.name) {
                    agents.push({
                        id: d.id, name: d.name, role: d.role || 'Custom Agent',
                        icon: d.icon || 'bot', systemPrompt: d.prompt,
                        history: d.history || [], color: d.color || '#06b6d4',
                        desc: d.desc || 'Custom agent.',
                        enabled: typeof d.enabled === 'boolean' ? d.enabled : true,
                        builtIn: false
                    });
                }
            });
        }
        if (data.communicationRules) {
             setCommunicationRules(data.communicationRules);
        }
        state.logEntries.forEach(e => renderLogEntry(e.agent, e.msg, e.type, e.time, true));
        renderMissionCanvas();
    } catch (e) { console.error('Load session failed:', e); }
}

export function saveMissionToArchive(title) {
    const id = `mission_${Date.now()}`;
    const index = JSON.parse(localStorage.getItem('ai_team_archive') || '[]');
    index.unshift({ id, title: title.substring(0, 55), time: Date.now() });
    localStorage.setItem('ai_team_archive', JSON.stringify(index.slice(0, 25)));
    localStorage.setItem(`ai_team_${id}`, JSON.stringify({ 
        projectFiles: state.projectFiles, 
        fileMetadata: state.fileMetadata, 
        logEntries: state.logEntries, 
        title 
    }));
    renderMissionArchive();
}

export function renderMissionArchive() {
    const el = document.getElementById('mission-archive');
    if (!el) return;
    const index = JSON.parse(localStorage.getItem('ai_team_archive') || '[]');
    if (index.length === 0) {
        el.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No past missions.</div>';
        return;
    }
    el.innerHTML = index.map(m => `
        <div class="archive-item" onclick="window.aiTeam.loadArchiveMission('${m.id}')">
            <div class="archive-title">${m.title}</div>
            <div class="archive-date">${new Date(m.time).toLocaleDateString()}</div>
        </div>
    `).join('');
}

export function loadArchiveMission(id) {
    const raw = localStorage.getItem(`ai_team_${id}`);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.activeSessionBackup = {
        projectFiles: { ...state.projectFiles },
        fileMetadata: { ...state.fileMetadata },
        logEntries: [...state.logEntries],
        logHtml: document.getElementById('log-feed').innerHTML
    };
    state.isReadOnly = true;
    document.getElementById('readonly-banner').style.display = 'flex';
    document.getElementById('readonly-title').innerText = data.title || id;
    document.getElementById('start-mission').disabled = true;
    state.projectFiles = data.projectFiles || {};
    state.fileMetadata = data.fileMetadata || {};
    document.getElementById('log-feed').innerHTML = '';
    (data.logEntries || []).forEach(e => renderLogEntry(e.agent, e.msg, e.type, e.time, true));
    renderFileTree();
    renderMissionCanvas();
}

export function exitReadOnly() {
    state.isReadOnly = false;
    document.getElementById('readonly-banner').style.display = 'none';
    document.getElementById('start-mission').disabled = false;
    if (state.activeSessionBackup) {
        state.projectFiles = state.activeSessionBackup.projectFiles;
        state.fileMetadata = state.activeSessionBackup.fileMetadata || {};
        state.logEntries = state.activeSessionBackup.logEntries;
        document.getElementById('log-feed').innerHTML = state.activeSessionBackup.logHtml;
        renderFileTree();
        renderMissionCanvas();
        state.activeSessionBackup = null;
    }
}

export async function syncWithLocalFilesystem() {
    const pName = document.getElementById('project-name')?.value.trim() || state.projectName;
    try {
        const res = await fetch('/api/list', { method: 'POST', body: JSON.stringify({ projectName: pName }) });
        const data = await res.json();
        if (data.status === 'ok' && Array.isArray(data.files)) {
            const newFiles = {};
            for (const f of data.files) {
                const fRes = await fetch('/api/read', { method: 'POST', body: JSON.stringify({ projectName: pName, filename: f }) });
                const fData = await fRes.json();
                if (fData.status === 'ok') newFiles[f] = fData.content;
            }
            state.projectFiles = newFiles;
            renderFileTree();
            addLog('System', `Synced project folder: [${pName}]`, 'system');
        }
    } catch (e) { console.error('Local sync failed:', e); }
}

export function renderMissionCanvas() {
    const container = document.getElementById('mission-canvas-container');
    const content = document.getElementById('mission-canvas-content');
    if (!container || !content) return;

    const missionMd = state.projectFiles['mission.md'];
    if (!missionMd) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    const lines = missionMd.split('\n');
    let html = '';
    let listOpen = false;

    lines.forEach(line => {
        const trimmed = line.trim();
        // Phase Headers (H1 or H2)
        if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
            if (listOpen) { html += '</div></div>'; listOpen = false; }
            const title = trimmed.replace(/^#+\s*/, '');
            html += `<div class="phase-block">
                <div class="phase-header">
                    <i data-lucide="compass" style="width:14px; height:14px;"></i>
                    <span>${title}</span>
                </div>
                <div class="task-list">`;
            listOpen = true;
        } 
        // Tasks (supports - [ ], * [ ], [ ])
        else if (trimmed.match(/^[*-]?\s*\[[ x]]/)) {
            const isDone = trimmed.includes('[x]');
            const taskText = trimmed.replace(/^[*-]?\s*\[[ x]]\s*/, '');
            html += `
                <div class="task-item ${isDone ? 'completed' : ''}">
                    <div class="task-checkbox">${isDone ? '<i data-lucide="check"></i>' : ''}</div>
                    <div class="task-content">${taskText}</div>
                </div>`;
        }
    });

    if (listOpen) html += '</div></div>';
    
    content.innerHTML = html || '<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding: 1rem; text-align: center;">Team Leader is drafting the roadmap...</div>';
    if (window.lucide) window.lucide.createIcons();
}
