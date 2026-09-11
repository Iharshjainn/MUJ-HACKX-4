/**
 * FinWise AI Advisor & What-If Scenario Simulator Interface
 * Includes seamless direct-browser fallback for static deployments like Netlify!
 */

class ChatController {
    constructor() {
        this.history = [];
        this.isDrawerOpen = false;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const toggleBtn = document.getElementById('chat-toggle-btn');
        const closeBtn = document.getElementById('chat-close-btn');
        const chatForm = document.getElementById('chat-form');
        const scenarioBtn = document.getElementById('open-scenario-btn');
        const scenarioForm = document.getElementById('scenario-form');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDrawer());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleDrawer(false));
        }

        if (chatForm) {
            chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (scenarioBtn) {
            scenarioBtn.addEventListener('click', () => {
                window.app.openModal('scenario-modal');
            });
        }

        if (scenarioForm) {
            scenarioForm.addEventListener('submit', (e) => this.handleScenarioSubmit(e));
        }

        // Quick prompt chips
        document.querySelectorAll('.prompt-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                if (prompt) {
                    this.toggleDrawer(true);
                    this.sendUserMessage(prompt);
                }
            });
        });
    }

    toggleDrawer(open) {
        const drawer = document.getElementById('chat-drawer');
        const backdrop = document.getElementById('chat-backdrop');
        if (!drawer) return;

        if (open === undefined) {
            this.isDrawerOpen = !this.isDrawerOpen;
        } else {
            this.isDrawerOpen = open;
        }

        if (this.isDrawerOpen) {
            drawer.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
            setTimeout(() => document.getElementById('chat-input')?.focus(), 300);
        } else {
            drawer.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        await this.sendUserMessage(text);
    }

    async sendUserMessage(text, scenario = null) {
        this.appendMessage('user', text);
        this.history.push({ role: 'user', content: text });

        const snapshot = window.app ? window.app.getFinancialSnapshot() : null;
        const loaderId = this.appendLoadingMessage();

        try {
            // Attempt to call the Python backend first
            const payload = {
                message: text,
                history: this.history.slice(-6),
                financial_snapshot: snapshot,
                scenario: scenario,
                api_key: window.CONFIG.GEMINI_API_KEY || undefined
            };

            const backendUrl = window.CONFIG.BACKEND_URL.replace(/\/$/, '');
            let reply = "";
            let simulation = null;

            try {
                const response = await fetch(`${backendUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const data = await response.json();
                    reply = data.reply;
                    simulation = data.simulation;
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (netErr) {
                console.warn("Backend API unreachable, using client-side fallback engine:", netErr.message);
                // Run Client-Side Engine (Perfect for Netlify static deployments!)
                const result = await this.clientSideProcess(text, snapshot, scenario);
                reply = result.reply;
                simulation = result.simulation;
            }

            this.removeLoadingMessage(loaderId);
            this.appendMessage('assistant', reply, simulation);
            this.history.push({ role: 'assistant', content: reply });

            // Refresh suggestion prompts
            const suggestions = [
                "How can I cut $200 from my monthly expenses?",
                "What is my current savings rate and runway?",
                "If I buy an iPhone 16 Pro for $1,199, what happens to my goals?",
                "How can I accelerate my emergency fund target?"
            ];
            this.renderDynamicSuggestions(suggestions);

        } catch (err) {
            console.error("Chat error:", err);
            this.removeLoadingMessage(loaderId);
            this.appendMessage('assistant', `⚠️ **Error:** ${err.message}`);
        }
    }

    async clientSideProcess(text, snapshot, scenario) {
        // Detect scenario from text if not passed
        if (!scenario) {
            scenario = this.extractScenario(text);
        }

        let simulation = null;
        if (scenario && snapshot) {
            simulation = this.calculateSimulation(snapshot, scenario);
        }

        const apiKey = window.CONFIG.GEMINI_API_KEY;
        let reply = "";

        if (apiKey) {
            try {
                if (apiKey.startsWith("sk-")) {
                    reply = await this.callOpenAIDirect(apiKey, text, snapshot, simulation);
                } else {
                    reply = await this.callGeminiDirect(apiKey, text, snapshot, simulation);
                }
            } catch (aiErr) {
                console.warn("Direct AI call failed:", aiErr);
                reply = this.buildDeterministicReply(text, snapshot, simulation);
                reply += `\n\n*(Note: Cloud AI connection note: ${aiErr.message.slice(0, 100)}. Rendered deterministic calculation above.)*`;
            }
        } else {
            reply = this.buildDeterministicReply(text, snapshot, simulation);
        }

        return { reply, simulation };
    }

    extractScenario(text) {
        const match = text.match(/(?:buy|purchase|spend|get)\s+(?:an?|the)?\s*([a-zA-Z0-9\s]{2,25}?)\s+(?:for|at|worth)\s*\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
        if (match) {
            const cost = parseFloat(match[2].replace(/,/g, ''));
            const item_name = match[1].trim();
            if (cost > 0) {
                return { item_name, cost, payment_type: 'one_time', installments_months: 12 };
            }
        }
        return null;
    }

    calculateSimulation(snapshot, scenario) {
        const income = snapshot.monthly_income || 0;
        const expenses = snapshot.total_expenses || 0;
        const currentSavings = income - expenses;
        const cost = scenario.cost;
        const paymentType = scenario.payment_type || 'one_time';
        const months = scenario.installments_months || 12;

        let monthlyCost = cost;
        let projectedSavings = currentSavings - cost;
        let reductionPct = currentSavings > 0 ? (cost / currentSavings * 100) : 100;

        if (paymentType === 'installments') {
            monthlyCost = cost / months;
            projectedSavings = currentSavings - monthlyCost;
            reductionPct = currentSavings > 0 ? (monthlyCost / currentSavings * 100) : 100;
        }

        let score = 90;
        let riskLevel = "Low";
        let canAfford = true;

        if (currentSavings <= 0 || projectedSavings < 0) {
            score = 15;
            riskLevel = "Critical";
            canAfford = false;
        } else if (reductionPct > 70) {
            score = 45;
            riskLevel = "High";
            canAfford = false;
        } else if (reductionPct > 35) {
            score = 68;
            riskLevel = "Moderate";
            canAfford = true;
        }

        const goalsImpact = (snapshot.goals || []).map(g => {
            const target = g.target_amount;
            const current = g.current_amount || 0;
            const remaining = Math.max(0, target - current);
            const numGoals = Math.max(1, (snapshot.goals || []).length);
            const monthlyGoalAlloc = Math.max(1, currentSavings / numGoals);
            const delay = parseFloat(((cost / numGoals) / monthlyGoalAlloc).toFixed(1));
            return {
                goal_title: g.title,
                delayed_by_months: delay,
                feasibility_status: delay > 2 ? 'Moderately Delayed' : 'Minor Delay'
            };
        });

        return {
            item_name: scenario.item_name,
            cost: cost,
            can_afford: canAfford,
            affordability_score: score,
            risk_level: riskLevel,
            current_monthly_savings: currentSavings,
            projected_monthly_savings: projectedSavings,
            savings_reduction_pct: parseFloat(reductionPct.toFixed(1)),
            goals_impact: goalsImpact
        };
    }

    async callGeminiDirect(apiKey, userText, snapshot, simulation) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const context = `Income: $${snapshot.monthly_income}, Expenses: $${snapshot.total_expenses}, Net Savings: $${snapshot.net_savings}. ` +
            (simulation ? `Scenario: ${simulation.item_name} ($${simulation.cost}), Affordability Score: ${simulation.affordability_score}/100, Risk: ${simulation.risk_level}.` : '');

        const payload = {
            contents: [{
                role: 'user',
                parts: [{ text: `You are FinWise personal financial advisor. Context: ${context}\n\nUser Question: ${userText}` }]
            }]
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
    }

    async callOpenAIDirect(apiKey, userText, snapshot, simulation) {
        const url = 'https://api.openai.com/v1/chat/completions';
        const context = `Income: $${snapshot.monthly_income}, Expenses: $${snapshot.total_expenses}, Net Savings: $${snapshot.net_savings}. ` +
            (simulation ? `Scenario: ${simulation.item_name} ($${simulation.cost}), Affordability Score: ${simulation.affordability_score}/100, Risk: ${simulation.risk_level}.` : '');

        const payload = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: `You are FinWise personal financial advisor. Context: ${context}` },
                { role: 'user', content: userText }
            ]
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
        const data = await res.json();
        return data.choices[0].message.content;
    }

    buildDeterministicReply(userText, snapshot, simulation) {
        if (simulation) {
            const badge = simulation.affordability_score >= 75 ? "🟢 Safe to Buy" : (simulation.affordability_score >= 50 ? "🟡 Proceed with Caution" : "🔴 High Risk / Not Recommended");
            let out = `### Financial What-If Analysis: ${simulation.item_name}\n\n` +
                `**Verdict:** ${badge} (Affordability Score: **${simulation.affordability_score}/100**, Risk: **${simulation.risk_level}**)\n\n` +
                `**Key Numbers:**\n` +
                `- **Purchase Cost:** $${simulation.cost.toLocaleString()}\n` +
                `- **Current Monthly Savings:** $${simulation.current_monthly_savings.toLocaleString()}\n` +
                `- **Projected Savings (After Purchase):** $${simulation.projected_monthly_savings.toLocaleString()}\n` +
                `- **Cash Flow Impact:** Consumes **${simulation.savings_reduction_pct}%** of your monthly savings.\n\n`;

            if (simulation.goals_impact && simulation.goals_impact.length > 0) {
                out += `**Impact on Active Savings Goals:**\n`;
                simulation.goals_impact.forEach(g => {
                    out += `- 🎯 **${g.goal_title}**: Estimated delay of **+${g.delayed_by_months} months** (${g.feasibility_status})\n`;
                });
                out += `\n`;
            }

            out += `**FinWise Advice:**\n`;
            if (simulation.affordability_score >= 75) {
                out += `1. **Green light:** You have sufficient net cash flow to absorb this purchase without derailing essential funds.\n` +
                       `2. Keep your emergency buffer untouched.\n`;
            } else if (simulation.affordability_score >= 50) {
                out += `1. **Consider 1-2 Month Delay:** Save specifically for this purchase over the next 30-60 days to prevent slowing down existing goals.\n` +
                       `2. **Check Installment Options:** A 0% APR 6-12 month installment plan could preserve monthly liquidity.\n`;
            } else {
                out += `1. **Hold Off:** This purchase exceeds comfortable risk levels for your current monthly savings rate.\n` +
                       `2. **Set a Goal:** Create a new savings goal in FinWise specifically for this item.\n`;
            }
            return out;
        }

        return `### FinWise Financial Summary\n\n` +
            `- **Monthly Income:** $${(snapshot.monthly_income || 0).toLocaleString()}\n` +
            `- **Monthly Expenses:** $${(snapshot.total_expenses || 0).toLocaleString()}\n` +
            `- **Net Monthly Savings:** $${(snapshot.net_savings || 0).toLocaleString()} (${(snapshot.savings_rate_pct || 0).toFixed(1)}% savings rate)\n\n` +
            `Ask me any **What-if purchase scenario** (e.g. *"If I buy an iPhone 16 for $1,199 now, how will it affect my goals?"*) to simulate the impact!`;
    }

    async handleScenarioSubmit(e) {
        e.preventDefault();
        const item_name = document.getElementById('scenario-item').value.trim();
        const cost = parseFloat(document.getElementById('scenario-cost').value);
        const payment_type = document.getElementById('scenario-type').value;
        const installments_months = parseInt(document.getElementById('scenario-months').value) || 12;

        if (!item_name || isNaN(cost) || cost <= 0) {
            window.app.showToast("Please enter a valid item name and positive cost.", "error");
            return;
        }

        const scenario = { item_name, cost, payment_type, installments_months };
        window.app.closeModal('scenario-modal');
        this.toggleDrawer(true);

        const promptText = payment_type === 'installments' 
            ? `What happens to my financial health and goals if I buy "${item_name}" for $${cost.toLocaleString()} on a ${installments_months}-month installment plan?`
            : `What happens to my financial health and goals if I buy "${item_name}" for $${cost.toLocaleString()} right now?`;

        await this.sendUserMessage(promptText, scenario);
    }

    appendMessage(role, text, simulation = null) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-bubble ${role}`;

        let simulationHtml = '';
        if (simulation) {
            const riskClass = simulation.risk_level === 'Low' ? 'badge-income' : (simulation.risk_level === 'Moderate' ? 'badge-demo' : 'badge-expense');
            simulationHtml = `
                <div class="simulation-card">
                    <div class="sim-header">
                        <strong>📊 What-If Impact: ${this.escapeHtml(simulation.item_name)}</strong>
                        <span class="badge ${riskClass}">Risk: ${simulation.risk_level}</span>
                    </div>
                    <div class="sim-metrics">
                        <div class="sim-metric">
                            <span class="lbl">Affordability Score</span>
                            <span class="val font-bold">${simulation.affordability_score}/100</span>
                        </div>
                        <div class="sim-metric">
                            <span class="lbl">Savings Reduction</span>
                            <span class="val text-danger">-${simulation.savings_reduction_pct}%</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const formattedText = this.formatMarkdown(text);
        msgDiv.innerHTML = `
            <div class="bubble-header">${role === 'user' ? 'You' : 'FinWise Advisor'}</div>
            <div class="bubble-content">${formattedText}</div>
            ${simulationHtml}
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    appendLoadingMessage() {
        const container = document.getElementById('chat-messages');
        if (!container) return null;

        const id = 'loader-' + Date.now();
        const loaderDiv = document.createElement('div');
        loaderDiv.id = id;
        loaderDiv.className = 'chat-bubble assistant typing-indicator';
        loaderDiv.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        container.appendChild(loaderDiv);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    removeLoadingMessage(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    renderDynamicSuggestions(suggestions) {
        const container = document.getElementById('chat-suggestions');
        if (!container) return;

        container.innerHTML = suggestions.map(s => `
            <button class="prompt-chip" onclick="window.ChatController.sendUserMessage('${this.escapeHtml(s)}')">
                ${this.escapeHtml(s)}
            </button>
        `).join('');
    }

    formatMarkdown(text) {
        if (!text) return '';
        let escaped = this.escapeHtml(text);

        escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="chat-h4">$1</h4>');
        escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="chat-h3">$1</h3>');
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
        escaped = escaped.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        escaped = escaped.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        escaped = escaped.replace(/\n\n/g, '<br><br>');
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ChatController = new ChatController();
});
