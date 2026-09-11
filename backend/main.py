from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.models import (
    ChatRequest, 
    ChatResponse, 
    WhatIfScenario, 
    SimulationResult, 
    FinancialSnapshot
)
from backend.services.scenario_engine import ScenarioEngine
from backend.services.ai_advisor import AIAdvisorService

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Financial Tracker API with AI What-If Scenario Advisor"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for easy development and multi-domain deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "supabase_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY)
    }

@app.post("/api/simulate", response_model=SimulationResult)
def simulate_scenario(payload: dict):
    """
    Direct endpoint to run deterministic mathematical what-if simulations.
    Expects { snapshot: FinancialSnapshot, scenario: WhatIfScenario }
    """
    try:
        snapshot_data = payload.get("snapshot", {})
        scenario_data = payload.get("scenario", {})
        
        snapshot = FinancialSnapshot(**snapshot_data)
        scenario = WhatIfScenario(**scenario_data)
        
        result = ScenarioEngine.simulate(snapshot, scenario)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_advisor(request: ChatRequest):
    """
    AI Financial Advisor Chatbot endpoint.
    Takes user prompt, financial snapshot, history, and optional scenario.
    """
    try:
        response = await AIAdvisorService.process_chat(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Advisor processing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
