# 🧠 AI Team Operation Center

A **zero-dependency, browser-based multi-agent IDE** that orchestrates a team of specialized AI agents to autonomously build software projects — powered by any local Ollama model.

![AI Operation Center](https://img.shields.io/badge/status-active-10b981?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-6366f1?style=flat-square) ![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Ollama-f59e0b?style=flat-square)

---

## ✨ What It Does

You describe a project. A team of AI agents — each with a distinct role — plan, build, review, and iterate on it autonomously, communicating with each other and committing files to a shared repository.

```
You: "Build a Snake game in Python, make it look nice"

Alex  → Plans 4 development steps, assigns each to the right specialist
Codey → Writes snake_game.py with full game logic
Vidia → Expands the file with Pygame UI and styling
Buster → Reviews for bugs, flags issues
Sigmund → Roundtable: UX psychology feedback
Alex  → Evaluates: complete ✅ or triggers a follow-up sprint 🔁
```

---

## 🤖 The Team

| Agent | Role | Specialty |
|---|---|---|
| **Alex** | Team Leader | Sprint planning, routing, evaluation |
| **Codey** | Lead Programmer | Complete working code in any language |
| **Vidia** | UI Designer | Layouts, CSS, UX flows |
| **Buster** | Quality Tester | Bug detection, status flagging |
| **Sigmund** | UX Psychologist | Cognitive principles, Fitts' law, Gestalt |
| **Ana** | Data Analyst | Algorithms, data structures, math |
| **Pen** | Copywriter | READMEs, docstrings, user-facing copy |

---

## 🏗️ Architecture

### Neural Orchestration
Alex acts as an AI-powered dispatcher. For each task, he evaluates the full team roster and picks the best agent — no hardcoded keyword routing.

### GitHub-Flow Collaboration
Agents share a live repository. The system enforces a two-action model:
- `write_file` — create a **new** file
- `edit_file` — **append** a labeled section to a teammate's existing file

A content-length guard blocks accidental overwrites. Each file tracks its author and any contributors, shown as colored dots in the file tree.

### Structured JSON Protocol
Every agent responds in a strict JSON schema with `thoughts`, `action`, `steps`, `status`, and `message` fields. No freetext parsing. Agent output is streamed live to the terminal using regex needle extraction — the message field renders progressively as it's generated.

### Sprint Lifecycle
```
Sprint 1: Alex plans → agents execute → Roundtable review
             ↓
        Evaluation: complete? → ✅ Archive mission
                   needs_review? → Sprint 2 → Final review
```

### Agent-to-Agent Messaging
Any agent can query a teammate mid-task using `action: ask`. The exchange is visible in the terminal as amber conversation entries.

---

## 🚀 Setup

### 1. Install Ollama
```bash
# https://ollama.com
ollama pull llama3.2
```

### 2. Start Ollama with CORS enabled

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

**macOS / Linux:**
```bash
OLLAMA_ORIGINS="*" ollama serve
```

### 3. Serve the app
```bash
cd ai-team
python -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

> ⚠️ Must be served via HTTP (not opened as a file) for the File System Access API to work.

---

## 🎮 Usage

1. Set your **Ollama endpoint** (default: `http://localhost:11434`)
2. Enter the **model name** (e.g. `llama3.2`, `mistral`, `codellama`)
3. Describe your **mission** in the text area
4. Set **Steps / Sprint** (4 recommended for smaller models)
5. Click **Execute**

Watch the Activity Log as agents plan, build, review, and communicate in real time. Switch to the **Repository** tab to browse and preview committed files.

---

## 🖥️ Interface

| Panel | Description |
|---|---|
| **Left sidebar** | Configuration, parameters, Mission Archive |
| **Center** | Agent team grid + Mission Pipeline stepper |
| **Right sidebar** | Activity Log (agent cards) + Repository browser |

### Activity Log
- **Agent cards** — colored avatar, role, status badge, streamed message, inner thoughts
- **System pills** — phase transitions (sprint start, roundtable, etc.)
- **Amber entries** — agent-to-agent conversations

### Mission Archive
Every completed mission is saved to `localStorage`. Click any entry to enter **read-only mode** and browse its full log and file history. Click **Exit** to return to the active session.

---

## ⚙️ Configuration Tips

| Setting | Recommendation |
|---|---|
| Model | `llama3.2` for speed, `mistral` or `codellama` for code quality |
| Steps / Sprint | 3–4 for smaller models, up to 8 for larger ones |
| Temperature | 0.6–0.7 for structured output reliability |
| num_ctx | Automatically set to 4096 per request |

Click the **edit icon** on any agent card to customize their system prompt directly in the browser.

---

## 📁 Project Structure

```
ai-team/
├── index.html   # App shell, layout, modal
├── style.css    # Dark theme, card log, repo browser
└── app.js       # Orchestration engine, LLM layer, state
```

Zero build steps. Zero dependencies (beyond Lucide icons and marked.js from CDN).

---

## 📜 License

MIT — do whatever you want with it.
