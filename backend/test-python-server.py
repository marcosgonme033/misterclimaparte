from http.server import BaseHTTPRequestHandler, HTTPServer

class TestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Python server OK')
        print('GET request received')

PORT = 5002
server = HTTPServer(('localhost', PORT), TestHandler)
print(f'Python server running on http://localhost:{PORT}')
server.serve_forever()
