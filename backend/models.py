from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class TransactionItem(BaseModel):
    id: Optional[str] = None
    title: str
    amount: float
    type: str = Field(description="'income' or 'expense'")
    category: str
    date: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = False

class BudgetItem(BaseModel):
    id: Optional[str] = None
    category: str
    monthly_limit: float

class GoalItem(BaseModel):
    id: Optional[str] = None
    title: str
    target_amount: float
    current_amount: float = 0.0
    target_date: Optional[str] = None
    category: Optional[str] = "General"

class FinancialSnapshot(BaseModel):
    currency: str = "USD"
    monthly_income: float = 0.0
    total_expenses: float = 0.0
    net_savings: float = 0.0
    savings_rate_pct: float = 0.0
    category_breakdown: Dict[str, float] = Field(default_factory=dict)
    transactions: List[TransactionItem] = Field(default_factory=list)
    budgets: List[BudgetItem] = Field(default_factory=list)
    goals: List[GoalItem] = Field(default_factory=list)

class WhatIfScenario(BaseModel):
    item_name: str
    cost: float
    payment_type: str = "one_time"  # 'one_time' or 'installments'
    installments_months: Optional[int] = 12
    category: Optional[str] = "Discretionary"
    target_goal_id: Optional[str] = None

class GoalImpact(BaseModel):
    goal_id: Optional[str] = None
    goal_title: str
    original_target_date: Optional[str] = None
    delayed_by_months: float
    current_progress_pct: float
    projected_progress_pct: float
    feasibility_status: str

class SimulationResult(BaseModel):
    item_name: str
    cost: float
    can_afford: bool
    affordability_score: int  # 0 to 100
    risk_level: str  # 'Low', 'Moderate', 'High', 'Critical'
    current_monthly_savings: float
    projected_monthly_savings: float
    savings_reduction_pct: float
    goals_impact: List[GoalImpact] = Field(default_factory=list)
    key_metrics: Dict[str, Any] = Field(default_factory=dict)
    mathematical_verdict: str

class ChatMessage(BaseModel):
    role: str = Field(description="'user', 'assistant', or 'system'")
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = Field(default_factory=list)
    financial_snapshot: Optional[FinancialSnapshot] = None
    scenario: Optional[WhatIfScenario] = None
    api_key: Optional[str] = None  # Optional user-supplied Gemini API key

class ChatResponse(BaseModel):
    reply: str
    simulation: Optional[SimulationResult] = None
    suggestions: List[str] = Field(default_factory=list)
