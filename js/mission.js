/**
 * Mission Cycle & Orchestration
 */
import { state, MAX_TOTAL_STEPS } from './config.js';
import { agents } from './agents.js';
import { callLLM, extractStreamMessage, safeStr } from './llm.js';
import { commitFile, executeLocalCommand } from './actions.js';
import { 
    addLog, renderFileTree, saveSession, saveMissionToArchive, 
    showStatusBanner, renderStepper 
} from './ui.js';

export async function runAgentTurn(agentId, prompt, statusMsg) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !state.isMissionRunning) return null;

    const card = document.getElementById('card-' + agent.id);
    const statusLabel = document.getElementById('status-' + agent.id);
    const pipeline = document.getElementById('pipeline-status');

    if (card) card.classList.add('pulse');
    if (statusLabel) { statusLabel.textContent = 'WORKING'; statusLabel.className = 'agent-status'; }
    if (pipeline) pipeline.innerText = agent.role + ': ' + statusMsg;

    let logRef = null;

    try {
        logRef = addLog(agent.name, '\u258c', 'agent');
        const communicationRules = state.communicationRules;
        const identityPrompt = `IDENTITY: You are ${agent.name}, ${agent.role}. Never impersonate another agent.\n\n${prompt}`;

        const parsed = await callLLM(agent, identityPrompt, communicationRules, (content, thinking) => {
            const cursor = logRef.querySelector('.log-body-content');
            if (!cursor) return;
            let html = '';
            if (thinking) {
                html += '<details class="log-thinking-block" open>' +
                    '<summary class="log-thinking-label">\ud83e\udde0 Reasoning</summary>' +
                    '<div class="log-thinking-content is-streaming">' + window.marked.parse(thinking) + '</div></details>';
            }
            if (content) {
                html += window.marked.parse(extractStreamMessage(content) + ' \u258c');
            } else if (thinking) {
                html += '<span style="opacity:0.3">\u258c awaiting response...</span>';
            }
            cursor.innerHTML = html;
        });

        if (!parsed) return null;

        if (logRef) {
            const body = logRef.querySelector('.log-body-content');
            if (body) {
                let finalHtml = '';
                if (parsed._thinking) {
                    finalHtml += '<details class="log-thinking-block">' +
                        '<summary class="log-thinking-label">\ud83e\udde0 Reasoning</summary>' +
                        '<div class="log-thinking-content">' + window.marked.parse(parsed._thinking) + '</div></details>';
                }
                finalHtml += window.marked.parse(safeStr(parsed.message || '(no message)'));

                // Collapsible Protocol Block
                const protocol = { logic: parsed.logic, status: parsed.status, actions: parsed.actions };
                finalHtml += `
                    <details class="log-protocol-block">
                        <summary class="log-protocol-label"><i data-lucide="terminal" style="width:12px;"></i> Protocol Data</summary>
                        <div class="log-protocol-content">
                            <pre><code>${JSON.stringify(protocol, null, 2)}</code></pre>
                        </div>
                    </details>`;
                
                body.innerHTML = finalHtml;
            }

            if (parsed.status) {
                const slot = logRef.querySelector('.log-card-badge-slot');
                if (slot) {
                    const sc = parsed.status === 'complete' ? '#10b981' : (parsed.status === 'needs_review' ? '#f59e0b' : '#ef4444');
                    const label = parsed.status.replace('_', ' ').toUpperCase();
                    let badgeHtml = `<span class="log-status-badge" style="background:${sc}22;color:${sc}">${label}</span>`;
                    
                    if (parsed.actions && parsed.actions.length > 1) {
                        badgeHtml += ` <span class="log-status-badge" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">${parsed.actions.length} ACTIONS</span>`;
                    }
                    slot.innerHTML = badgeHtml;
                }
            }

            if (parsed.logic || parsed.thoughts) {
                const lbody = logRef.querySelector('.log-card-body');
                if (lbody) {
                    const t = document.createElement('div');
                    t.className = 'log-card-thoughts';
                    t.innerText = `\ud83d\udcad ${safeStr(parsed.logic || parsed.thoughts)}`;
                    lbody.appendChild(t);
                }
            }
        }

        const actionQueue = Array.isArray(parsed.actions) ? parsed.actions : [];
        if (actionQueue.length === 0 && (parsed.action || parsed.type) && (parsed.action !== 'suggest' && parsed.type !== 'suggest')) {
            actionQueue.push(parsed.action ? {
                type: parsed.action, filename: parsed.filename, content: parsed.content,
                search: parsed.search, replace: parsed.replace, command: parsed.command
            } : parsed);
        }

        for (const act of actionQueue) {
            let type = (act.type || act.action || '').toLowerCase().replace(/_/g, '');
            const filename = act.filename || act.file;
            const content = safeStr(act.content || act.code || act.text);
            const search = act.search || act.find;
            const replace = act.replace || act.with;

            if ((type === 'writefile' || type === 'write') && filename) {
                await commitFile(filename, content, agent.name, agents, renderFileTree, saveSession, addLog, 'write');
            } else if ((type === 'editfile' || type === 'edit') && filename) {
                await commitFile(filename, null, agent.name, agents, renderFileTree, saveSession, addLog, 'edit', search, replace);
            } else if ((type === 'readfile' || type === 'read') && filename) {
                const existing = state.projectFiles[filename] || '(File empty or not found)';
                agent.history.push({ role: 'user', content: `Content of "${filename}":\n\n${existing}` });
                addLog('System', `${agent.name} read \`${filename}\``, 'system');
            } else if ((type === 'runcommand' || type === 'run' || type === 'terminal') && act.command) {
                const result = await executeLocalCommand(act.command, agent.name, addLog);
                if (result && result.status === 'ok') {
                    agent.history.push({ role: 'user', content: `Command output (exit ${result.code}):\n${result.stdout}\n${result.stderr}` });
                } else if (result && result.error) {
                    agent.history.push({ role: 'user', content: `Command failed: ${result.error}` });
                }
            }
        }

        if (parsed.status) state.sprintStatuses.push(parsed.status);
        return parsed;

    } catch (e) {
        addLog('System', `Error (${agent.name}): ${e.message}`, 'system');
        agent.history.push({ role: 'user', content: `SYSTEM ERROR: ${e.message}` });
        throw e;
    } finally {
        if (card) card.classList.remove('pulse');
        if (statusLabel) { statusLabel.textContent = 'IDLE'; statusLabel.className = 'agent-status idle'; }
    }
}

export async function startMissionCycle(mission) {
    state.isMissionRunning = true;
    state.sprintStatuses = [];
    document.getElementById('start-mission').disabled = true;
    document.getElementById('stop-mission').style.display = 'block';
    document.getElementById('status-banner').style.display = 'none';

    addLog('System', 'Mission started', 'system');
    let totalTurns = 0;
    
    try {
        let lastAgentResponse = null;

        while (state.isMissionRunning && totalTurns < MAX_TOTAL_STEPS) {
            totalTurns++;
            
            // --- DIRECTOR PHASE (Alex reviews and delegates) ---
            const repoState = Object.entries(state.projectFiles).length === 0 
                ? "Repository is EMPTY." 
                : Object.entries(state.projectFiles)
                    .map(([f, c]) => `FILE: ${f}\n\`\`\`\n${(c || '').toString().substring(0, 300)}${(c || '').toString().length > 300 ? '...' : ''}\n\`\`\``)
                    .join('\n\n');
            
            const roadmap = state.projectFiles['mission.md'] || '';
            
            const roster = agents.filter(a => a.enabled && a.id !== 'team-leader')
                .map(a => `- ID: ${a.id}, Name: ${a.name}, Role: ${a.role}`)
                .join('\n');
            
            let alexPrompt = `MISSION: "${mission}"\nROADMAP (mission.md):\n${roadmap}\n\n`;
            alexPrompt += `AVAILABLE TEAM:\n${roster}\n\n`;
            alexPrompt += `REPO STATE:\n${repoState}\n\n`;
            
            if (lastAgentResponse) {
                alexPrompt += `LAST WORKER (${lastAgentResponse.agentName}) STATUS: ${lastAgentResponse.status}\nMESSAGE: ${lastAgentResponse.message}\n\n`;
            }

            alexPrompt += `DIRECTOR ROLE:
1. If "mission.md" is missing, you MUST use "write_file" to create it.
2. If tasks finished, update "mission.md" with [x].
3. Pick NEXT available agent (by ID or Name) and give them a "delegated_task".
4. If mission complete, status="done".

JSON: {"agent_id": "...", "delegated_task": "...", "actions": [], "status": "busy", "message": "..."}`;

            addLog('System', `Director Review (Turn ${totalTurns})...`, 'system');
            const delegation = await runAgentTurn('team-leader', alexPrompt, `Directing...`);
            
            if (!delegation || !state.isMissionRunning) break;
            if (delegation.status === 'done') {
                addLog('System', 'Director declared mission complete.', 'system');
                break;
            }

            const query = (delegation.agent_id || '').toLowerCase().trim().replace(/^@/, '');
            const agent = agents.find(a => a.enabled && (
                a.id.toLowerCase() === query || 
                a.name.toLowerCase() === query || 
                a.role.toLowerCase().includes(query)
            ));
            const taskLabel = delegation.delegated_task || 'Working...';
            
            if (!agent) {
                addLog('System', 'No enabled agent found.', 'error');
                break;
            }

            // --- WORKER PHASE (Autonomous sequence: Up to 4 turns) ---
            addLog('System', `Delegating to ${agent.name} (4 turn limit)...`, 'system');
            
            for (let workerStep = 0; workerStep < 4; workerStep++) {
                if (!state.isMissionRunning) break;
                
                const workerPrompt = `MISSION: ${mission}\nYOUR TASK: ${taskLabel}\nTURN: ${workerStep + 1}/4\n\nACTIONS: Use tools to progress. Set status="done" when task finished.`;

                const workerResult = await runAgentTurn(agent.id, workerPrompt, `Working (${workerStep + 1}/4): ${(taskLabel || '').substring(0, 20)}...`);
                
                if (!workerResult || !state.isMissionRunning) break;
                
                lastAgentResponse = { agentName: agent.name, status: workerResult.status, message: workerResult.message || '(no message)' };

                if (workerResult.status === 'done' || workerResult.status === 'complete') {
                    addLog('System', `${agent.name} is done.`, 'system');
                    break;
                }
            }
        }

        if (state.isMissionRunning) {
            showStatusBanner('complete', `Mission Complete — ${totalTurns} orchestration turns.`);
            saveMissionToArchive(mission);
            saveSession();
        }
    } catch (e) {
        if (e.message !== 'Stopped') addLog('System', `Mission halted: ${e.message}`, 'system');
        showStatusBanner('error', 'Mission Stopped');
    } finally {
        state.isMissionRunning = false;
        document.getElementById('start-mission').disabled = false;
        document.getElementById('stop-mission').style.display = 'none';
        const ps = document.getElementById('pipeline-status');
        if (ps) ps.innerText = 'Ready...';
    }
}
