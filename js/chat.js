/**
 * FinWise AI Advisor & What-If Scenario Simulator Interface
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
            // Focus input
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
            const payload = {
                message: text,
                history: this.history.slice(-6), // Send recent context
                financial_snapshot: snapshot,
                scenario: scenario,
                api_key: window.CONFIG.GEMINI_API_KEY || undefined
            };

            const backendUrl = window.CONFIG.BACKEND_URL.replace(/\/$/, '');
            const response = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `Server status ${response.status}`);
            }

            const data = await response.json();
            this.removeLoadingMessage(loaderId);

            // Render AI Reply
            this.appendMessage('assistant', data.reply, data.simulation);
            this.history.push({ role: 'assistant', content: data.reply });

            // If suggestions returned, update suggestions chips
            if (data.suggestions && data.suggestions.length > 0) {
                this.renderDynamicSuggestions(data.suggestions);
            }

        } catch (err) {
            console.error("Chat error:", err);
            this.removeLoadingMessage(loaderId);
            this.appendMessage(
                'assistant', 
                `⚠️ **Unable to connect to AI Advisor backend** (${err.message}).\n\n` +
                `Please verify the Python backend is running locally at \`${window.CONFIG.BACKEND_URL}\` (run \`python -m uvicorn backend.main:app --port 8000\`), or verify your network connection.`
            );
        }
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

        const scenario = {
            item_name,
            cost,
            payment_type,
            installments_months
        };

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
        loaderDiv.innerHTML = `
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        `;
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

        // Markdown Headers
        escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="chat-h4">$1</h4>');
        escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="chat-h3">$1</h3>');

        // Bold
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Inline code
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Lists
        escaped = escaped.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        escaped = escaped.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // Line breaks
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
