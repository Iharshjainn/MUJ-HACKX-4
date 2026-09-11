"""
FinWise One-Click Application Runner.
Starts the FastAPI Backend and Frontend Static Server concurrently,
then automatically opens your browser.
"""

import sys
import os
import subprocess
import time
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

def run_backend():
    print("[BACKEND] Starting FastAPI Backend on http://127.0.0.1:8000...")
    cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]
    proc = subprocess.Popen(cmd, cwd=PROJECT_ROOT)
    return proc

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)
    def log_message(self, format, *args):
        pass  # Quiet HTTP logging

def run_frontend():
    print("[FRONTEND] Serving Dashboard on http://127.0.0.1:5500...")
    server = HTTPServer(('127.0.0.1', 5500), CustomHandler)
    server.serve_forever()

def main():
    print("=" * 60)
    print("  [LAUNCHING] FinWise Financial Tracker & AI Advisor")
    print("=" * 60)

    # 1. Start backend process
    backend_proc = run_backend()

    # 2. Start frontend in background thread
    frontend_thread = threading.Thread(target=run_frontend, daemon=True)
    frontend_thread.start()

    # Wait 1.5 seconds for servers to bind
    time.sleep(1.5)

    app_url = "http://127.0.0.1:5500"
    print(f"\n[READY] Opening FinWise Dashboard in your browser: {app_url}")
    print("[INFO] Press Ctrl + C in this terminal to stop the application.\n")
    
    webbrowser.open(app_url)

    try:
        backend_proc.wait()
    except KeyboardInterrupt:
        print("\n[FINWISE] Shutting down application servers...")
        backend_proc.terminate()
        backend_proc.wait()
        print("[FINWISE] Goodbye!")

if __name__ == "__main__":
    main()
