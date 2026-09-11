import re
import json
import logging
from typing import Optional, List, Dict, Any
import httpx
from backend.config import settings
from backend.models import (
    ChatRequest, 
    ChatResponse, 
    SimulationResult, 
    WhatIfScenario, 
    FinancialSnapshot
)
from backend.services.scenario_engine import ScenarioEngine

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are FinWise AI, an expert, pragmatic, and encouraging personal financial advisor and scenario analyst.
Your mission is to help users make smart money decisions by analyzing their real-time financial data, budgeting, and savings goals.

When users ask 'What-if' questions (e.g. buying a new iPhone, going on a vacation, taking an auto loan, cutting expenses):
1. Analyze their real numbers: Monthly Income, Monthly Expenses, Net Monthly Savings, Savings Rate, and Active Goals.
2. Directly answer whether they can afford it and assess the risk (Low / Moderate / High / Critical).
3. Explicitly explain the trade-offs: How many months of savings it consumes, and exactly how many weeks/months it will delay their specific savings goals.
4. Provide 2-3 concrete actionable strategies or alternatives (e.g., waiting X weeks, cutting specific non-essential categories, or opting for an installment plan).
5. Maintain a supportive, motivating, yet financially disciplined tone. Format your response cleanly with markdown, bullet points, and bold figures.
"""

class AIAdvisorService:
    @staticmethod
    def _extract_scenario_from_text(text: str) -> Optional[WhatIfScenario]:
        """Simple regex heuristic to detect purchase scenarios if not explicitly passed."""
        # e.g., "buy an iphone for $1200" or "bought a laptop for 800" or "$1500 on vacation"
        patterns = [
            r"(?:buy|purchase|spend|get)\s+(?:an?|the)?\s*([a-zA-Z0-9\s]{2,25}?)\s+(?:for|at|worth)\s*\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)",
            r"\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s+(?:on|for)\s+(?:an?|the)?\s*([a-zA-Z0-9\s]{2,25})"
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                g1, g2 = match.groups()
                try:
                    # check which group is numeric
                    val_str = g2 if any(char.isdigit() for char in g2) else g1
                    name_str = g1 if val_str == g2 else g2
                    cost = float(val_str.replace(",", ""))
                    item_name = name_str.strip().title()
                    if cost > 0 and len(item_name) > 1:
                        return WhatIfScenario(item_name=item_name, cost=cost, payment_type="one_time")
                except Exception:
                    pass
        return None

    @classmethod
    async def process_chat(cls, request: ChatRequest) -> ChatResponse:
        snapshot = request.financial_snapshot or FinancialSnapshot()
        
        # If scenario wasn't explicitly passed, attempt heuristic extraction from message
        scenario = request.scenario or cls._extract_scenario_from_text(request.message)
        
        simulation: Optional[SimulationResult] = None
        if scenario:
            simulation = ScenarioEngine.simulate(snapshot, scenario)

        # Determine Gemini API Key
        api_key = (request.api_key or "").strip() or settings.GEMINI_API_KEY.strip()

        if api_key:
            try:
                reply = await cls._call_gemini_api(api_key, request, snapshot, simulation)
            except Exception as e:
                logger.error(f"Gemini API call failed: {e}")
                reply = cls._generate_fallback_response(request.message, snapshot, simulation)
                reply += f"\n\n*(Note: Cloud AI connection encountered an issue: {str(e)[:120]}. Provided deterministic financial calculation above.)*"
        else:
            # Smart deterministic offline financial advisor
            reply = cls._generate_fallback_response(request.message, snapshot, simulation)

        suggestions = [
            "How can I cut $200 from my monthly expenses?",
            "What is my current savings rate and runway?",
            "If I buy an iPhone 16 Pro for $1,199, what happens to my goals?",
            "How can I accelerate my emergency fund target?"
        ]

        return ChatResponse(
            reply=reply,
            simulation=simulation,
            suggestions=suggestions
        )

    @classmethod
    async def _call_gemini_api(
        cls, 
        api_key: str, 
        request: ChatRequest, 
        snapshot: FinancialSnapshot, 
        simulation: Optional[SimulationResult]
    ) -> str:
        # Build prompt with financial context
        context_parts = [
            "=== USER FINANCIAL SNAPSHOT ===",
            f"- Currency: {snapshot.currency}",
            f"- Monthly Income: ${snapshot.monthly_income:,.2f}",
            f"- Total Monthly Expenses: ${snapshot.total_expenses:,.2f}",
            f"- Net Monthly Cash Flow: ${snapshot.net_savings:,.2f}",
            f"- Savings Rate: {snapshot.savings_rate_pct:.1f}%",
        ]

        if snapshot.category_breakdown:
            breakdown_str = ", ".join([f"{k}: ${v:,.2f}" for k, v in snapshot.category_breakdown.items()])
            context_parts.append(f"- Expense Breakdown by Category: {breakdown_str}")

        if snapshot.budgets:
            budgets_str = ", ".join([f"{b.category}: Limit ${b.monthly_limit:,.2f}" for b in snapshot.budgets])
            context_parts.append(f"- Category Budgets: {budgets_str}")

        if snapshot.goals:
            goals_str = "; ".join([
                f"'{g.title}' (Target: ${g.target_amount:,.2f}, Saved: ${g.current_amount:,.2f} "
                f"[{round((g.current_amount/g.target_amount*100) if g.target_amount else 0, 1)}%], Target Date: {g.target_date or 'None'})"
                for g in snapshot.goals
            ])
            context_parts.append(f"- Active Savings Goals: {goals_str}")

        if simulation:
            context_parts.append("\n=== WHAT-IF SIMULATION ENGINE RESULTS ===")
            context_parts.append(f"- Evaluated Item: {simulation.item_name} (Cost: ${simulation.cost:,.2f})")
            context_parts.append(f"- Affordability Verdict: {'AFFORDABLE' if simulation.can_afford else 'NOT RECOMMENDED / HIGH RISK'}")
            context_parts.append(f"- Affordability Score: {simulation.affordability_score}/100 (Risk: {simulation.risk_level})")
            context_parts.append(f"- Projected Monthly Net Savings After: ${simulation.projected_monthly_savings:,.2f}")
            context_parts.append(f"- Savings Reduction: -{simulation.savings_reduction_pct:.1f}%")
            if simulation.goals_impact:
                delays = ", ".join([f"{g.goal_title}: +{g.delayed_by_months} months delay ({g.feasibility_status})" for g in simulation.goals_impact])
                context_parts.append(f"- Goals Impact: {delays}")
            context_parts.append(f"- Mathematical Summary: {simulation.mathematical_verdict}")

        context_prompt = "\n".join(context_parts)

        # Prepare messages for Gemini REST API
        contents = []
        
        # System instructions
        full_system = f"{SYSTEM_PROMPT}\n\n{context_prompt}"

        # History
        for msg in (request.history or []):
            role = "user" if msg.role == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.content}]
            })

        # Latest message
        contents.append({
            "role": "user",
            "parts": [{"text": f"User question: {request.message}"}]
        })

        # Using Gemini 1.5 Flash endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "system_instruction": {
                "parts": [{"text": full_system}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1000
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                # Try fallback model or error
                error_detail = resp.text
                logger.warning(f"Gemini API returned status {resp.status_code}: {error_detail}")
                raise Exception(f"Gemini API error ({resp.status_code}): {resp.json().get('error', {}).get('message', 'Unknown')}")
            
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"]
            return "I analyzed your financial data, but could not generate a response. Please try again."

    @classmethod
    def _generate_fallback_response(
        cls, 
        message: str, 
        snapshot: FinancialSnapshot, 
        simulation: Optional[SimulationResult]
    ) -> str:
        """Smart deterministic financial advisor response when no external API key is configured."""
        if simulation:
            score = simulation.affordability_score
            verdict_badge = "🟢 Safe to Buy" if score >= 75 else ("🟡 Proceed with Caution" if score >= 50 else "🔴 Not Recommended")
            
            response_lines = [
                f"### Financial What-If Analysis: {simulation.item_name}",
                f"**Verdict:** {verdict_badge} (Affordability Score: **{score}/100**, Risk: **{simulation.risk_level}**)",
                "",
                f"**Mathematical Breakdown:**",
                f"- **Purchase Cost:** ${simulation.cost:,.2f}",
                f"- **Current Net Monthly Savings:** ${simulation.current_monthly_savings:,.2f}",
                f"- **Projected Net Savings (After Purchase):** ${simulation.projected_monthly_savings:,.2f}",
                f"- **Impact on Cashflow:** Consumes **{simulation.savings_reduction_pct:.1f}%** of your regular monthly savings.",
                ""
            ]

            if simulation.goals_impact:
                response_lines.append("**Impact on Active Goals:**")
                for g in simulation.goals_impact:
                    status_emoji = "⚠️" if g.delayed_by_months > 1.0 else "✅"
                    response_lines.append(f"- {status_emoji} **{g.goal_title}**: Estimated delay of **+{g.delayed_by_months} months** ({g.feasibility_status}).")
                response_lines.append("")

            response_lines.append("**Advisor Recommendations:**")
            if score >= 75:
                response_lines.append("1. **Go for it!** Your cash flow comfortably absorbs this purchase without threatening your monthly obligations.")
                response_lines.append("2. Ensure you do not dip into your core emergency reserves.")
            elif score >= 50:
                response_lines.append(f"1. **Postpone or Save:** Delay the purchase by 1-2 months to pay out of designated surplus rather than halting your savings goals.")
                response_lines.append("2. **Explore 0% Installments:** Spreading the expense over 6-12 months can keep your monthly cash flow positive.")
                response_lines.append("3. **Offset with Budget Trimming:** Temporarily cut dining out or discretionary spending by 20% during this period.")
            else:
                response_lines.append("1. **Hold Off:** This purchase significantly stresses your cashflow or turns your monthly balance negative.")
                response_lines.append("2. **Build a Sinking Fund:** Set up a dedicated mini-goal in FinWise and save for this item over 3-6 months first.")

            return "\n".join(response_lines)
        
        # General question fallback
        income = snapshot.monthly_income
        expenses = snapshot.total_expenses
        net = snapshot.net_savings
        rate = snapshot.savings_rate_pct

        return (
            f"### FinWise Financial Overview\n\n"
            f"Here is your current financial standing based on your recorded transactions:\n"
            f"- **Monthly Income:** ${income:,.2f}\n"
            f"- **Monthly Expenses:** ${expenses:,.2f}\n"
            f"- **Net Savings:** ${net:,.2f} ({rate:.1f}% savings rate)\n\n"
            f"💡 **Tip:** You can ask me any **'What-if' scenario**, for example:\n"
            f"- *'If I buy an iPhone 16 for $1,199, how does it affect my goals?'*\n"
            f"- *'Can I afford a $2,500 vacation next month?'*\n"
            f"- *'How will financing a $400/mo car affect my savings?'*\n\n"
            f"*(Add your Google Gemini API key in Settings or .env to enable full conversational AI!)*"
        )
