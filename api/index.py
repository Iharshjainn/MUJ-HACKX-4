"""
Vercel Serverless Function entry point.
Redirects /api requests to FastAPI backend app.
"""
import sys
import os

# Add the project root to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.main import app
