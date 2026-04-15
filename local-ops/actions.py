import os
import subprocess
import json

# The actual root where serve_local.bat is
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_project_path(project_name):
    """Get the absolute path for a project, ensuring it stays within workspace."""
    if not project_name:
        project_name = "default-project"
    
    # Sanitize name
    safe_name = "".join([c for c in project_name if c.isalnum() or c in ('-', '_')]).strip()
    if not safe_name:
        safe_name = "default-project"
        
    project_path = os.path.abspath(os.path.join(WORKSPACE_ROOT, safe_name))
    
    # Ensure it's inside WORKSPACE_ROOT
    if not project_path.startswith(WORKSPACE_ROOT):
        project_path = os.path.join(WORKSPACE_ROOT, "default-project")
        
    os.makedirs(project_path, exist_ok=True)
    return project_path

def is_safe_path(project_name, filename):
    """Ensure the file path stays within the project folder."""
    root = get_project_path(project_name)
    abs_path = os.path.abspath(os.path.join(root, filename))
    return abs_path.startswith(root)

def write_file(project_name, filename, content):
    if not is_safe_path(project_name, filename):
        return {"error": "Path traversal detected."}
    
    root = get_project_path(project_name)
    full_path = os.path.join(root, filename)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return {"status": "ok", "filename": filename, "project": project_name}

COMMAND_WHITELIST = {
    'python', 'pip', 'npm', 'node', 'npx', 'git',
    'dir', 'echo', 'type', 'mkdir', 'ls', 'cat', 'pwd',
    'venv', 'virtualenv', 'pytest', 'npm-test'
}

def is_safe_command(command):
    """Basic check to see if the command starts with a whitelisted tool."""
    cmd_parts = command.strip().split()
    if not cmd_parts:
        return False
    
    executable = cmd_parts[0].lower().replace('.exe', '')
    # Handle paths like .\venv\Scripts\python
    executable = os.path.basename(executable)
    
    return executable in COMMAND_WHITELIST

def run_command(project_name, command):
    if not is_safe_command(command):
        return {"error": f"Command '{command.split()[0]}' is not in the whitelist. Forbidden for security."}
    
    root = get_project_path(project_name)
    try:
        # Run command inside the project directory
        result = subprocess.run(
            command,
            shell=True,
            cwd=root,
            capture_output=True,
            text=True,
            timeout=30
        )
        return {
            "status": "ok",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"error": "Command timed out after 30 seconds."}
    except Exception as e:
        return {"error": str(e)}

def list_files(project_name):
    root = get_project_path(project_name)
    files = []
    for r, dirs, filenames in os.walk(root):
        rel_root = os.path.relpath(r, root)
        if rel_root == ".":
            rel_root = ""
            
        for f in filenames:
            files.append(os.path.join(rel_root, f).replace("\\", "/"))
    
    return {"status": "ok", "files": sorted(files), "project": project_name}

def read_file(project_name, filename):
    if not is_safe_path(project_name, filename):
        return {"error": "Path traversal detected."}
    
    root = get_project_path(project_name)
    full_path = os.path.join(root, filename)
    if not os.path.exists(full_path):
        return {"error": "File not found."}
        
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    return {"status": "ok", "content": content, "project": project_name}
