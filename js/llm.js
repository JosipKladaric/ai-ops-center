/**
 * LLM Interface
 */
import { state } from './config.js';

export function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))).join('\n');
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
}

export function extractStreamMessage(raw) {
    const m = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (m) {
        return m[1].replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return raw.replace(/^\s*\{/, '').replace(/"[\w]+"\s*:/g, '').replace(/[{}"]/g, '').replace(/\\n/g, '\n').trim();
}

export async function callLLM(agent, userPrompt, communicationRules, onChunk) {
    const serverIp = document.getElementById('server-ip').value.trim();
    const model = document.getElementById('llm-model').value.trim();

    const res = await fetch(`${serverIp}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [
                { 
                    role: 'system', 
                    content: agent.systemPrompt + (communicationRules ? `\n\nCOMMUNICATION RULES:\n${communicationRules}` : '')
                },
                ...agent.history.map(m => {
                    if (m.role === 'assistant') {
                        try {
                            const parsed = JSON.parse(m.content);
                            const sanitized = { ...parsed };
                            delete sanitized.logic;
                            delete sanitized.thoughts;
                            delete sanitized._thinking;
                            return { role: m.role, content: JSON.stringify(sanitized) };
                        } catch (e) { return m; }
                    }
                    return m;
                }),
                { role: 'user', content: userPrompt }
            ],
            format: 'json',
            think: document.getElementById('llm-think').checked,
            options: {
                temperature: parseFloat(document.getElementById('llm-temp').value) || 0.7,
                num_ctx: 16384
            },
            stream: true
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        if (res.status === 400 && (errText.includes('think') || errText.includes('unknown field'))) {
            document.getElementById('llm-think').checked = false;
            return callLLM(agent, userPrompt, communicationRules, onChunk);
        }
        throw new Error('HTTP ' + res.status + ': ' + errText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullThinking = '';
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
                if (j.message) {
                    if (j.message.thinking) fullThinking += j.message.thinking;
                    if (j.message.content) fullContent += j.message.content;
                    if (onChunk) onChunk(fullContent, fullThinking);
                }
            } catch (e) { }
        }
        if (!state.isMissionRunning) { reader.cancel(); break; }
    }

    agent.history.push({ role: 'user', content: userPrompt });
    agent.history.push({ role: 'assistant', content: fullContent });
    if (agent.history.length > 12) agent.history = agent.history.slice(-6);

    try {
        const result = JSON.parse(fullContent);
        result._thinking = fullThinking;
        return result;
    } catch (e) {
        const match = fullContent.match(/\{[\s\S]*\}/);
        if (match) {
            try { const r = JSON.parse(match[0]); r._thinking = fullThinking; return r; } catch (e2) { }
        }
        return { action: 'suggest', status: 'complete', message: fullContent, thoughts: '', _thinking: fullThinking };
    }
}
