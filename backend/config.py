import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "FinWise AI Financial Tracker"
    VERSION: str = "1.0.0"
    
    # Google Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Server & CORS
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ALLOWED_ORIGINS: List[str] = [
        origin.strip() for origin in os.getenv(
            "ALLOWED_ORIGINS", 
            "http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000,*"
        ).split(",") if origin.strip()
    ]

settings = Settings()
