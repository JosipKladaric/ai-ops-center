/**
 * Global Configuration & State
 */

export const JSON_SCHEMA = `
TEMPLATE (REQUIRED):
{
  "logic": "1-sentence decision",
  "actions": [
    { "type": "write_file", "filename": "path.ext", "content": "..." },
    { "type": "read_file", "filename": "path.ext" },
    { "type": "edit_file", "filename": "path.ext", "search": "...", "replace": "..." },
    { "type": "run_command", "command": "..." }
  ],
  "status": "done | busy",
  "message": "Succinct summary for the Team Leader.",
  "ask": { "to": "agent-id", "question": "..." }
}`;

export const BASE_SYSTEM_PROMPT = `Output the TEMPLATE JSON immediately. No preamble.`;

export let communicationRules = JSON_SCHEMA + `

COMMUNICATION RULES:
1. DIRECTOR MODE: The Team Leader (Alex) manages "mission.md". Workers do NOT edit mission.md unless explicitly asked.
2. CONTEXT: You will only be given the repo state and your specific task.
3. STATUS: Set status to "busy" if you need another turn to finish. Set "done" when your assigned task is complete.
4. CHAIN ACTIONS: You can perform multiple actions in one turn.
5. Windows Environment: You are on Windows. Use 'dir' for listing, but 'read_file' is preferred.
`;

export function setCommunicationRules(rules) {
    state.communicationRules = rules;
}

export const CUSTOM_AGENT_COLORS = ['#06b6d4', '#a855f7', '#f43f5e', '#84cc16', '#e879f9', '#fb923c', '#22d3ee', '#facc15'];
export let nextCustomColorIdx = 0;
export function incrementColorIdx() { nextCustomColorIdx++; }

// State Storage
export const state = {
    projectFiles: {},
    fileMetadata: {},
    logEntries: [],
    communicationRules: communicationRules,
    isMissionRunning: false,
    projectName: 'default-project',
    currentEditingAgentId: null,
    activeFilename: null,
    isReadOnly: false,
    activeDirectoryHandle: null,
    activeSessionBackup: null,
    sprintStatuses: [],
    isLocalEngine: window.location.port === "8000"
};

export const MAX_TOTAL_STEPS = 20;
