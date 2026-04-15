/**
 * AI Team Ops Center - Main Entry Point (Bootstrap)
 */
import { state, setCommunicationRules, communicationRules } from './js/config.js';
import { 
    agents, renderAgents, toggleAgent, deleteAgent, 
    openAddAgentModal, saveNewAgent, openPromptEditor 
} from './js/agents.js';
import { 
    renderFileTree, 
    addLog, syncWithLocalFilesystem, saveSession, loadSession,
    selectFile, loadArchiveMission, exitReadOnly
} from './js/ui.js';
import { startMissionCycle } from './js/mission.js';

// Initialize the application
function bootstrap() {
    window.aiTeam = {
        selectFile, openPromptEditor, exitReadOnly, loadArchiveMission,
        toggleAgent, deleteAgent, openAddAgentModal, saveNewAgent,
        saveSession, startMissionCycle,
        resetSession: () => {
            if (!confirm('Clear all session data and start fresh?')) return;
            localStorage.removeItem('ai_team_active');
            window.location.reload();
        }
    };

    loadSession(communicationRules, setCommunicationRules);
    
    // Engine detection UI
    const pill = document.getElementById('local-engine-pill');
    const localGroup = document.getElementById('local-project-group');
    const webGroup = document.getElementById('web-folder-group');

    if (state.isLocalEngine) {
        if (pill) pill.style.display = 'block';
        if (localGroup) localGroup.style.display = 'block';
        if (webGroup) webGroup.style.display = 'none';
        syncWithLocalFilesystem();
    } else {
        if (pill) pill.style.display = 'none';
        if (localGroup) localGroup.style.display = 'none';
        if (webGroup) webGroup.style.display = 'block';
        addLog('System', 'Hybrid Mode: Local Engine not detected. Using Web File System API.', 'system');
    }

    renderAgents();
    renderFileTree();
    setupGlobalEvents();
}

function setupGlobalEvents() {
    const safeAddListener = (id, event, cb) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, cb);
    };

    safeAddListener('start-mission', 'click', () => {
        if (state.isReadOnly) return;
        const desc = document.getElementById('project-description').value.trim();
        if (desc) startMissionCycle(desc);
    });

    safeAddListener('stop-mission', 'click', () => {
        state.isMissionRunning = false;
    });

    safeAddListener('save-prompt', 'click', () => {
        const agent = agents.find(a => a.id === state.currentEditingAgentId);
        if (agent) agent.systemPrompt = document.getElementById('modal-prompt-text').value;
        document.getElementById('prompt-modal').style.display = 'none';
        saveSession();
    });

    safeAddListener('reset-session', 'click', () => {
        if (!confirm('Clear current session data?')) return;
        localStorage.removeItem('ai_team_active');
        window.location.reload();
    });

    safeAddListener('project-name', 'input', (e) => {
        state.projectName = e.target.value.trim() || 'default-project';
        saveSession();
    });

    safeAddListener('llm-model', 'input', () => {
        saveSession();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.console-tab').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(`${tabId}-tab`);
            if (target) target.classList.add('active');
        });
    });

    safeAddListener('close-modal', 'click', () => {
        const modal = document.getElementById('prompt-modal');
        if (modal) modal.style.display = 'none';
    });
    
    safeAddListener('edit-comm-rules', 'click', () => {
        document.getElementById('comm-rules-text').value = state.communicationRules;
        document.getElementById('comm-rules-modal').style.display = 'flex';
    });

    safeAddListener('close-comm-rules', 'click', () => {
        document.getElementById('comm-rules-modal').style.display = 'none';
    });

    safeAddListener('save-comm-rules', 'click', () => {
        setCommunicationRules(document.getElementById('comm-rules-text').value);
        document.getElementById('comm-rules-modal').style.display = 'none';
        saveSession();
    });
}

window.addEventListener('DOMContentLoaded', bootstrap);
