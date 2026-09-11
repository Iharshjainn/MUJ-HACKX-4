/**
 * FinWise Main Application Controller
 */

class App {
    constructor() {
        this.transactions = [];
        this.budgets = [];
        this.goals = [];
        this.currentView = 'dashboard';
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadAllData();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Navigation clicks
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Transaction form submit
        const txForm = document.getElementById('transaction-form');
        if (txForm) {
            txForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        }

        // Budget form submit
        const budgetForm = document.getElementById('budget-form');
        if (budgetForm) {
            budgetForm.addEventListener('submit', (e) => this.handleBudgetSubmit(e));
        }

        // Goal form submit
        const goalForm = document.getElementById('goal-form');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => this.handleGoalSubmit(e));
        }

        // Settings form submit
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => this.handleSettingsSubmit(e));
        }

        // Auth forms
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
        }

        // Search & Filter
        const searchInput = document.getElementById('tx-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderTransactionsTable());
        }
        const filterSelect = document.getElementById('tx-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.renderTransactionsTable());
        }

        // Set default date input to today
        const dateInput = document.getElementById('tx-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(`view-${viewName}`);
        if (targetSec) targetSec.classList.add('active');

        if (viewName === 'dashboard') {
            this.updateDashboard();
        }
    }

    async loadAllData() {
        try {
            this.showLoader(true);
            this.transactions = await window.DataService.getTransactions();
            this.budgets = await window.DataService.getBudgets();
            this.goals = await window.DataService.getGoals();

            this.updateDashboard();
            this.renderTransactionsTable();
            this.renderBudgets();
            this.renderGoals();
        } catch (error) {
            console.error("Failed to load data:", error);
            this.showToast("Error loading financial data: " + error.message, "error");
        } finally {
            this.showLoader(false);
        }
    }

    async checkAuthStatus() {
        const user = await window.DataService.getCurrentUser();
        const userDisplay = document.getElementById('user-profile-display');
        const badgeMode = document.getElementById('mode-badge');

        if (window.DataService.isDemoMode) {
            if (badgeMode) {
                badgeMode.textContent = "Local Demo Mode";
                badgeMode.className = "badge badge-demo";
            }
        } else {
            if (badgeMode) {
                badgeMode.textContent = "Supabase Cloud";
                badgeMode.className = "badge badge-cloud";
            }
        }

        if (user && userDisplay) {
            const name = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
            userDisplay.innerHTML = `
                <div class="user-avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <span class="user-name">${name}</span>
                    <span class="user-email">${user.email || ''}</span>
                </div>
            `;
        }
    }

    // ==========================================
    // DASHBOARD CALCULATIONS
    // ==========================================

    getFinancialSnapshot() {
        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryMap = {};

        this.transactions.forEach(t => {
            const amt = parseFloat(t.amount);
            if (t.type === 'income') {
                totalIncome += amt;
            } else {
                totalExpenses += amt;
                categoryMap[t.category] = (categoryMap[t.category] || 0) + amt;
            }
        });

        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;

        return {
            currency: 'USD',
            monthly_income: totalIncome,
            total_expenses: totalExpenses,
            net_savings: netSavings,
            savings_rate_pct: savingsRate,
            category_breakdown: categoryMap,
            transactions: this.transactions,
            budgets: this.budgets,
            goals: this.goals
        };
    }

    updateDashboard() {
        const snapshot = this.getFinancialSnapshot();

        // Update Stat Cards
        const incEl = document.getElementById('stat-income');
        const expEl = document.getElementById('stat-expenses');
        const netEl = document.getElementById('stat-savings');
        const rateEl = document.getElementById('stat-savings-rate');

        if (incEl) incEl.textContent = `$${snapshot.monthly_income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (expEl) expEl.textContent = `$${snapshot.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        
        if (netEl) {
            netEl.textContent = `$${snapshot.net_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            netEl.className = snapshot.net_savings >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
        }

        if (rateEl) {
            rateEl.textContent = `${snapshot.savings_rate_pct.toFixed(1)}%`;
        }

        // Render Charts
        window.ChartManager.renderExpenseChart('expenseDonutChart', snapshot.category_breakdown);
        window.ChartManager.renderCashflowChart('cashflowBarChart', snapshot.monthly_income, snapshot.total_expenses, Math.max(0, snapshot.net_savings));
        
        // Render Recent Activity on Dashboard
        this.renderRecentTransactions(snapshot.transactions.slice(0, 5));
    }

    renderRecentTransactions(txs) {
        const container = document.getElementById('recent-transactions-list');
        if (!container) return;

        if (txs.length === 0) {
            container.innerHTML = `<div class="empty-state">No transactions recorded yet.</div>`;
            return;
        }

        container.innerHTML = txs.map(t => `
            <div class="recent-tx-item">
                <div class="tx-icon ${t.type}">
                    <i class="icon">${t.type === 'income' ? '↓' : '↑'}</i>
                </div>
                <div class="tx-details">
                    <span class="tx-title">${this.escapeHtml(t.title)}</span>
                    <span class="tx-meta">${t.category} • ${t.date}</span>
                </div>
                <div class="tx-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // TRANSACTIONS TABLE
    // ==========================================

    renderTransactionsTable() {
        const tbody = document.getElementById('transactions-table-body');
        if (!tbody) return;

        const searchTerm = (document.getElementById('tx-search')?.value || '').toLowerCase();
        const filterType = document.getElementById('tx-filter')?.value || 'all';

        let filtered = this.transactions.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
            const matchesFilter = filterType === 'all' || t.type === filterType;
            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No transactions found matching criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => `
            <tr>
                <td><strong>${this.escapeHtml(t.title)}</strong></td>
                <td><span class="category-pill">${t.category}</span></td>
                <td>${t.date}</td>
                <td><span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.type.toUpperCase()}</span></td>
                <td class="font-semibold ${t.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'income' ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                </td>
                <td>
                    <button class="btn-icon text-danger" title="Delete" onclick="window.app.deleteTransaction('${t.id}')">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async handleTransactionSubmit(e) {
        e.preventDefault();
        const title = document.getElementById('tx-title').value.trim();
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const type = document.getElementById('tx-type').value;
        const category = document.getElementById('tx-category').value;
        const date = document.getElementById('tx-date').value;
        const notes = document.getElementById('tx-notes')?.value || '';

        if (!title || isNaN(amount) || amount <= 0) {
            this.showToast("Please enter a valid title and positive amount.", "error");
            return;
        }

        try {
            await window.DataService.addTransaction({ title, amount, type, category, date, notes });
            this.showToast("Transaction recorded!", "success");
            e.target.reset();
            document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
            this.closeModal('transaction-modal');
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to save transaction: " + err.message, "error");
        }
    }

    async deleteTransaction(id) {
        if (!confirm("Are you sure you want to delete this transaction?")) return;
        try {
            await window.DataService.deleteTransaction(id);
            this.showToast("Transaction removed", "info");
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to delete transaction: " + err.message, "error");
        }
    }

    // ==========================================
    // BUDGETS VIEW
    // ==========================================

    renderBudgets() {
        const container = document.getElementById('budgets-grid');
        if (!container) return;

        // Calculate actual spent per category
        const spentMap = {};
        this.transactions.forEach(t => {
            if (t.type === 'expense') {
                spentMap[t.category] = (spentMap[t.category] || 0) + parseFloat(t.amount);
            }
        });

        if (this.budgets.length === 0) {
            container.innerHTML = `<div class="empty-state">No budgets set. Click "+ Add Budget" to set category spending limits.</div>`;
            return;
        }

        container.innerHTML = this.budgets.map(b => {
            const spent = spentMap[b.category] || 0;
            const limit = parseFloat(b.monthly_limit);
            const pct = Math.min(100, Math.round((spent / limit) * 100));
            let statusColor = 'var(--emerald)';
            if (pct >= 100) statusColor = 'var(--rose)';
            else if (pct >= 80) statusColor = 'var(--amber)';

            return `
                <div class="card budget-card">
                    <div class="budget-header">
                        <h4>${this.escapeHtml(b.category)}</h4>
                        <span class="budget-status ${spent > limit ? 'over-budget' : ''}">
                            $${spent.toFixed(0)} / $${limit.toFixed(0)}
                        </span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill" style="width: ${pct}%; background-color: ${statusColor};"></div>
                    </div>
                    <div class="budget-footer">
                        <span>${pct}% used</span>
                        <span>${spent > limit ? `Over by $${(spent - limit).toFixed(0)}` : `$${(limit - spent).toFixed(0)} left`}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    async handleBudgetSubmit(e) {
        e.preventDefault();
        const category = document.getElementById('budget-category').value.trim();
        const limit = parseFloat(document.getElementById('budget-limit').value);

        if (!category || isNaN(limit) || limit <= 0) {
            this.showToast("Please provide category and positive limit.", "error");
            return;
        }

        try {
            await window.DataService.saveBudget(category, limit);
            this.showToast(`Budget for ${category} saved!`, "success");
            this.closeModal('budget-modal');
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to save budget: " + err.message, "error");
        }
    }

    // ==========================================
    // SAVINGS GOALS VIEW
    // ==========================================

    renderGoals() {
        const container = document.getElementById('goals-grid');
        if (!container) return;

        if (this.goals.length === 0) {
            container.innerHTML = `<div class="empty-state">No savings goals created. Start by clicking "+ New Goal".</div>`;
            return;
        }

        container.innerHTML = this.goals.map(g => {
            const target = parseFloat(g.target_amount);
            const current = parseFloat(g.current_amount || 0);
            const pct = Math.min(100, Math.round((current / target) * 100));

            return `
                <div class="card goal-card">
                    <div class="goal-header">
                        <div>
                            <h4>${this.escapeHtml(g.title)}</h4>
                            <span class="text-muted text-sm">${g.category || 'General'} • Target: ${g.target_date || 'Ongoing'}</span>
                        </div>
                        <button class="btn-icon text-danger" onclick="window.app.deleteGoal('${g.id}')">🗑️</button>
                    </div>
                    <div class="goal-numbers">
                        <span class="goal-saved">$${current.toLocaleString()}</span>
                        <span class="goal-target">of $${target.toLocaleString()}</span>
                    </div>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill" style="width: ${pct}%; background-color: var(--primary);"></div>
                    </div>
                    <div class="goal-actions">
                        <span class="font-semibold text-sm">${pct}% Completed</span>
                        <button class="btn btn-sm btn-outline" onclick="window.app.promptAddFunds('${g.id}', '${this.escapeHtml(g.title)}')">+ Add Funds</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async promptAddFunds(goalId, title) {
        const amt = prompt(`Add funds to goal "${title}":`, "100");
        if (!amt || isNaN(amt) || parseFloat(amt) <= 0) return;

        try {
            await window.DataService.updateGoalProgress(goalId, parseFloat(amt));
            this.showToast(`Added $${parseFloat(amt).toFixed(2)} to ${title}!`, "success");
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to update goal: " + err.message, "error");
        }
    }

    async deleteGoal(id) {
        if (!confirm("Are you sure you want to delete this savings goal?")) return;
        try {
            await window.DataService.deleteGoal(id);
            this.showToast("Goal removed", "info");
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to delete goal: " + err.message, "error");
        }
    }

    async handleGoalSubmit(e) {
        e.preventDefault();
        const title = document.getElementById('goal-title').value.trim();
        const target_amount = parseFloat(document.getElementById('goal-target').value);
        const current_amount = parseFloat(document.getElementById('goal-initial').value || 0);
        const target_date = document.getElementById('goal-date').value || null;
        const category = document.getElementById('goal-category').value || 'General';

        if (!title || isNaN(target_amount) || target_amount <= 0) {
            this.showToast("Please provide a valid goal title and target amount.", "error");
            return;
        }

        try {
            await window.DataService.addGoal({ title, target_amount, current_amount, target_date, category });
            this.showToast("Goal created!", "success");
            this.closeModal('goal-modal');
            await this.loadAllData();
        } catch (err) {
            this.showToast("Failed to create goal: " + err.message, "error");
        }
    }

    // ==========================================
    // SETTINGS & AUTH
    // ==========================================

    openSettings() {
        document.getElementById('setting-supabase-url').value = window.CONFIG.SUPABASE_URL || '';
        document.getElementById('setting-supabase-key').value = window.CONFIG.SUPABASE_ANON_KEY || '';
        document.getElementById('setting-backend-url').value = window.CONFIG.BACKEND_URL || '';
        document.getElementById('setting-gemini-key').value = window.CONFIG.GEMINI_API_KEY || '';
        this.openModal('settings-modal');
    }

    handleSettingsSubmit(e) {
        e.preventDefault();
        const supabaseUrl = document.getElementById('setting-supabase-url').value;
        const supabaseAnonKey = document.getElementById('setting-supabase-key').value;
        const backendUrl = document.getElementById('setting-backend-url').value;
        const geminiKey = document.getElementById('setting-gemini-key').value;

        window.CONFIG.saveSettings({ supabaseUrl, supabaseAnonKey, backendUrl, geminiKey });
        window.DataService.initClient();
        this.showToast("Configuration saved successfully!", "success");
        this.closeModal('settings-modal');
        this.checkAuthStatus();
    }

    async handleAuthSubmit(e) {
        e.preventDefault();
        const isSignUp = document.getElementById('auth-mode-signup').checked;
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const fullName = document.getElementById('auth-name').value.trim();

        try {
            if (isSignUp) {
                await window.DataService.signUp(email, password, fullName);
                this.showToast("Account created successfully!", "success");
            } else {
                await window.DataService.signIn(email, password);
                this.showToast("Signed in successfully!", "success");
            }
            this.closeModal('auth-modal');
            this.checkAuthStatus();
            await this.loadAllData();
        } catch (err) {
            this.showToast("Auth failed: " + err.message, "error");
        }
    }

    async handleSignOut() {
        await window.DataService.signOut();
        this.showToast("Signed out", "info");
        this.checkAuthStatus();
        await this.loadAllData();
    }

    // ==========================================
    // UI UTILITIES
    // ==========================================

    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('active');
    }

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.remove('active');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    showLoader(show) {
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = show ? 'flex' : 'none';
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
