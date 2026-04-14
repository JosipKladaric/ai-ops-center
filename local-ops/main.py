import http.server
import socketserver
import json
import os
import actions

PORT = 8000
DIRECTORY = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class LocalOpsHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path.startswith('/api/'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            params = json.loads(post_data.decode('utf-8'))
            
            response = {"error": "Unknown endpoint"}
            p_name = params.get('projectName', 'default-project')
            print(f"API {self.path} | Project: [{p_name}] | File: {params.get('filename', 'N/A')}")
            
            if self.path == '/api/write':
                response = actions.write_file(p_name, params.get('filename'), params.get('content'))
            elif self.path == '/api/read':
                response = actions.read_file(p_name, params.get('filename'))
            elif self.path == '/api/list':
                response = actions.list_files(p_name)
            elif self.path == '/api/run':
                response = actions.run_command(p_name, params.get('command'))
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    print(f"Starting Local Ops Server at http://localhost:{PORT}")
    print(f"Serving UI from: {DIRECTORY}")
    
    with socketserver.TCPServer(("", PORT), LocalOpsHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    run_server()
