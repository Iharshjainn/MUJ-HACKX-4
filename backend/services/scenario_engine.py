from typing import List, Dict, Any
from backend.models import FinancialSnapshot, WhatIfScenario, SimulationResult, GoalImpact

class ScenarioEngine:
    @staticmethod
    def simulate(snapshot: FinancialSnapshot, scenario: WhatIfScenario) -> SimulationResult:
        income = max(0.0, snapshot.monthly_income)
        expenses = max(0.0, snapshot.total_expenses)
        current_savings = income - expenses
        
        cost = max(0.0, scenario.cost)
        payment_type = scenario.payment_type
        months = max(1, scenario.installments_months or 12)
        
        # Calculate monthly impact
        if payment_type == "installments":
            monthly_cost = cost / months
            projected_monthly_savings = current_savings - monthly_cost
            savings_reduction_pct = (monthly_cost / current_savings * 100.0) if current_savings > 0 else 100.0
        else:
            monthly_cost = cost
            # For one-time, during the purchase month:
            projected_monthly_savings = current_savings - cost
            savings_reduction_pct = (cost / current_savings * 100.0) if current_savings > 0 else 100.0

        # Assess affordability and score (0 to 100)
        score = 100
        risk_level = "Low"
        can_afford = True

        if current_savings <= 0:
            score = 10
            risk_level = "Critical"
            can_afford = False
        elif payment_type == "installments":
            if projected_monthly_savings < 0:
                score = 15
                risk_level = "Critical"
                can_afford = False
            else:
                utilization = (monthly_cost / current_savings)
                if utilization > 0.7:
                    score = 40
                    risk_level = "High"
                elif utilization > 0.4:
                    score = 65
                    risk_level = "Moderate"
                else:
                    score = 88
                    risk_level = "Low"
        else: # One-time purchase
            months_of_savings = cost / current_savings if current_savings > 0 else 999
            if months_of_savings > 6:
                score = 20
                risk_level = "Critical"
                can_afford = False
            elif months_of_savings > 3:
                score = 45
                risk_level = "High"
                can_afford = False
            elif months_of_savings > 1:
                score = 68
                risk_level = "Moderate"
                can_afford = True
            else:
                score = 92
                risk_level = "Low"
                can_afford = True

        # Goal impact calculations
        goals_impact: List[GoalImpact] = []
        for goal in snapshot.goals:
            remaining = max(0.0, goal.target_amount - goal.current_amount)
            curr_pct = round((goal.current_amount / goal.target_amount * 100.0), 1) if goal.target_amount > 0 else 100.0
            
            # Allocation estimation: share of current monthly savings going towards this goal
            # Assuming evenly distributed among goals if multiple exist
            num_goals = max(1, len(snapshot.goals))
            monthly_goal_contrib = max(1.0, current_savings / num_goals) if current_savings > 0 else 1.0
            
            if payment_type == "installments":
                # Reduced contribution over installment period
                new_contrib = max(0.0, projected_monthly_savings / num_goals)
                if new_contrib > 0:
                    delay_months = round((monthly_cost / num_goals) * months / monthly_goal_contrib, 1)
                else:
                    delay_months = round(months * 1.5, 1)
            else:
                # One time cost delay
                delay_months = round((cost / num_goals) / monthly_goal_contrib, 1)

            if delay_months > 12:
                feasibility = "Severely Delayed"
            elif delay_months > 3:
                feasibility = "Moderately Delayed"
            elif delay_months > 0.5:
                feasibility = "Minor Delay"
            else:
                feasibility = "Minimal Impact"

            goals_impact.append(
                GoalImpact(
                    goal_id=goal.id,
                    goal_title=goal.title,
                    original_target_date=goal.target_date,
                    delayed_by_months=delay_months,
                    current_progress_pct=curr_pct,
                    projected_progress_pct=curr_pct, # unchanged immediately unless funded from goal balance
                    feasibility_status=feasibility
                )
            )

        # Build crisp mathematical verdict
        if payment_type == "installments":
            verdict = (
                f"Purchasing '{scenario.item_name}' via {months} monthly installments of ${monthly_cost:.2f} "
                f"reduces your monthly savings from ${current_savings:.2f} to ${projected_monthly_savings:.2f} "
                f"(-{savings_reduction_pct:.1f}%). "
            )
        else:
            months_equiv = cost / current_savings if current_savings > 0 else 0
            verdict = (
                f"Purchasing '{scenario.item_name}' for a one-time cost of ${cost:.2f} "
                f"consumes equivalent to {months_equiv:.1f} months of your regular net savings (${current_savings:.2f}/mo). "
            )

        if goals_impact:
            delayed_goals_str = ", ".join([f"'{g.goal_title}' (+{g.delayed_by_months} mos)" for g in goals_impact[:2]])
            verdict += f"Impact on goals: {delayed_goals_str}. "

        verdict += f"Risk Level: {risk_level} (Score: {score}/100)."

        return SimulationResult(
            item_name=scenario.item_name,
            cost=cost,
            can_afford=can_afford,
            affordability_score=score,
            risk_level=risk_level,
            current_monthly_savings=round(current_savings, 2),
            projected_monthly_savings=round(projected_monthly_savings, 2),
            savings_reduction_pct=round(savings_reduction_pct, 1),
            goals_impact=goals_impact,
            key_metrics={
                "monthly_income": income,
                "monthly_expenses": expenses,
                "payment_type": payment_type,
                "installments_months": months if payment_type == "installments" else None,
                "monthly_installment": round(cost / months, 2) if payment_type == "installments" else None
            },
            mathematical_verdict=verdict
        )
