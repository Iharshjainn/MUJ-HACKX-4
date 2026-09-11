"""
Verification test suite for FinWise Backend: Scenario Engine, AI Advisor, and API Endpoints.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from starlette.testclient import TestClient
from backend.main import app
from backend.models import (
    FinancialSnapshot, 
    TransactionItem, 
    BudgetItem, 
    GoalItem, 
    WhatIfScenario,
    ChatRequest
)
from backend.services.scenario_engine import ScenarioEngine
from backend.services.ai_advisor import AIAdvisorService
import asyncio

def test_scenario_engine_one_time():
    snapshot = FinancialSnapshot(
        monthly_income=5000.0,
        total_expenses=3200.0,
        net_savings=1800.0,
        savings_rate_pct=36.0,
        goals=[
            GoalItem(title="Emergency Fund", target_amount=10000.0, current_amount=6000.0),
            GoalItem(title="Tokyo Vacation", target_amount=4000.0, current_amount=2000.0)
        ]
    )
    
    scenario = WhatIfScenario(
        item_name="iPhone 16 Pro",
        cost=1199.0,
        payment_type="one_time"
    )

    result = ScenarioEngine.simulate(snapshot, scenario)
    print("Simulation Result:", result.mathematical_verdict)
    assert result.item_name == "iPhone 16 Pro"
    assert result.cost == 1199.0
    assert result.can_afford is True
    assert result.affordability_score > 50
    assert len(result.goals_impact) == 2
    assert result.goals_impact[0].delayed_by_months > 0
    print("[PASS] Scenario Engine One-Time Test Passed!")

def test_scenario_engine_installments():
    snapshot = FinancialSnapshot(
        monthly_income=4000.0,
        total_expenses=3500.0,
        net_savings=500.0,
        savings_rate_pct=12.5,
        goals=[
            GoalItem(title="Emergency Fund", target_amount=5000.0, current_amount=1000.0)
        ]
    )
    
    scenario = WhatIfScenario(
        item_name="Luxury Car Lease",
        cost=12000.0,
        payment_type="installments",
        installments_months=24
    )

    result = ScenarioEngine.simulate(snapshot, scenario)
    # Monthly cost is 12000/24 = 500, which completely consumes the 500 net savings!
    assert result.projected_monthly_savings == 0.0
    assert result.risk_level in ["High", "Critical"]
    print("[PASS] Scenario Engine Installments Test Passed!")

def test_api_endpoints():
    client = TestClient(app)
    
    # 1. Root & Health
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "online"

    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    # 2. Simulate Endpoint
    payload = {
        "snapshot": {
            "monthly_income": 6000.0,
            "total_expenses": 3500.0,
            "net_savings": 2500.0,
            "goals": [{"title": "House Downpayment", "target_amount": 50000.0, "current_amount": 20000.0}]
        },
        "scenario": {
            "item_name": "MacBook Pro",
            "cost": 1999.0,
            "payment_type": "one_time"
        }
    }
    r_sim = client.post("/api/simulate", json=payload)
    assert r_sim.status_code == 200
    data = r_sim.json()
    assert data["item_name"] == "MacBook Pro"
    assert data["affordability_score"] > 60

    # 3. Chat Endpoint
    chat_payload = {
        "message": "If I buy an iPhone 16 for $1200, how does it affect my savings?",
        "financial_snapshot": payload["snapshot"]
    }
    r_chat = client.post("/api/chat", json=chat_payload)
    assert r_chat.status_code == 200
    chat_data = r_chat.json()
    assert "reply" in chat_data
    assert len(chat_data["reply"]) > 50
    assert chat_data["simulation"] is not None
    assert chat_data["simulation"]["cost"] == 1200.0
    print("[PASS] API Endpoints Test Passed!")

if __name__ == "__main__":
    test_scenario_engine_one_time()
    test_scenario_engine_installments()
    test_api_endpoints()
    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")
