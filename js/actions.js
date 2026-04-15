/**
 * File and Command Actions
 */
import { state } from './config.js';

export async function commitFile(filename, content, authorName, agents, renderFileTree, saveSession, addLog, mode = 'write', search = null, replace = null) {
    const agentObj = agents.find(a => a.name === authorName);
    const authorColor = agentObj ? agentObj.color : '#6b7280';
    const existing = state.projectFiles[filename];

    if ((mode === 'edit' || mode === 'insert_before' || mode === 'insert_after') && existing) {
        if (!search) {
            const err = `${authorName} tried to ${mode} \`${filename}\` without a \`search\` block.`;
            addLog('System', err, 'system');
            throw new Error(err);
        }
        
        if (existing.includes(search)) {
            let newContent = existing;
            if (mode === 'edit') {
                // If the prompt implies multiple replacements or agent sent "global": true (future)
                // For now, let's just make it replace all instances if it matches multiple times, 
                // as that's often what's desired in modular refactorings.
                newContent = existing.split(search).join(replace || '');
            } else if (mode === 'insert_before') {
                newContent = existing.replace(search, (content || '') + search);
            } else if (mode === 'insert_after') {
                newContent = existing.replace(search, search + (content || ''));
            }
            
            state.projectFiles[filename] = newContent;
            state.fileMetadata[filename] = { ...state.fileMetadata[filename], modified: authorName, modifiedColor: authorColor };
            addLog('System', `${authorName} modified \`${filename}\` (${mode})`, 'system');
        } else {
            const msg = `FAILED: Search block not found in "${filename}". Use the EXACT string including whitespace. Tip: Read the file first to copy the exact lines.`;
            addLog('System', `${authorName}: ${msg}`, 'system');
            throw new Error(msg);
        }
    } else if (mode === 'delete') {
        if (state.projectFiles[filename]) {
            delete state.projectFiles[filename];
            delete state.fileMetadata[filename];
            addLog('System', `${authorName} deleted \`${filename}\``, 'system');
        }
    } else if (mode === 'move') {
        // search would be target filename in "move" context if we adapt it
        // but let's stick to simple write for now or handle explicitly
    } else {
        state.projectFiles[filename] = content;
        const wasNew = !existing;
        if (wasNew) {
            state.fileMetadata[filename] = { author: authorName, authorColor: authorColor, created: Date.now() };
        } else {
            state.fileMetadata[filename] = { ...state.fileMetadata[filename], modified: authorName, modifiedColor: authorColor };
        }
        addLog('System', `${authorName} ${wasNew ? 'created' : 'updated'} \`${filename}\``, 'system');
    }

    state.activeFilename = filename;
    renderFileTree();

    if (filename === 'mission.md') {
        const { renderMissionCanvas } = await import('./ui.js');
        renderMissionCanvas();
    }

    const badge = document.getElementById('workspace-badge');
    if (badge) badge.style.display = 'inline-block';
    if (!state.isReadOnly) saveSession();

    if (state.isLocalEngine) {
        const pName = document.getElementById('project-name')?.value.trim() || state.projectName;
        try {
            await fetch('/api/write', {
                method: 'POST',
                body: JSON.stringify({ projectName: pName, filename, content: state.projectFiles[filename] || '' })
            });
        } catch (e) { console.error('Local write failed:', e); }
    } else if (state.activeDirectoryHandle) {
        try {
            if (mode === 'delete') {
                await state.activeDirectoryHandle.removeEntry(filename);
            } else {
                const h = await state.activeDirectoryHandle.getFileHandle(filename, { create: true });
                const w = await h.createWritable();
                await w.write(state.projectFiles[filename]);
                await w.close();
            }
        } catch (err) {
            addLog('System', 'Storage Error: Check folder permissions.', 'error');
        }
    }
}

export async function executeLocalCommand(command, agentName, addLog) {
    if (!state.isLocalEngine) {
        const msg = "Terminal / run_command requires the Local Python Engine.";
        addLog('System', msg, 'error');
        return { error: msg };
    }
    const pName = document.getElementById('project-name')?.value.trim() || state.projectName;
    addLog('System', `${agentName} executing: \`${command}\``, 'system');
    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            body: JSON.stringify({ projectName: pName, command })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            const output = (data.stdout || '') + (data.stderr || '');
            const safeOutput = output || '';
            addLog('System', `Output:\n${safeOutput.substring(0, 500)}${safeOutput.length > 500 ? '...' : ''}`, 'system');
            return data;
        } else {
            addLog('System', `Error: ${data.error}`, 'system');
            return data;
        }
    } catch (e) {
        addLog('System', `Failed to run command: ${e.message}`, 'system');
        return { error: e.message };
    }
}
