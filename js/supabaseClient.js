/**
 * FinWise Supabase Client & Data Layer
 * Bridges Supabase Cloud with fallback local storage for instant demo readiness.
 */

class DataService {
    constructor() {
        this.client = null;
        this.currentUser = null;
        this.isDemoMode = true;
    }

    async init() {
        // Sync configuration from backend .env if available
        if (window.CONFIG && window.CONFIG.syncWithBackend) {
            await window.CONFIG.syncWithBackend();
        }
        this.initClient();
    }

    initClient() {
        if (window.supabase && CONFIG.isSupabaseConfigured()) {
            try {
                this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
                this.isDemoMode = false;
                console.log("Connected to Supabase Cloud:", CONFIG.SUPABASE_URL);

                // Listen for authentication changes
                this.client.auth.onAuthStateChange((event, session) => {
                    this.currentUser = session?.user || null;
                    if (window.app) {
                        window.app.checkAuthStatus();
                    }
                });
            } catch (err) {
                console.warn("Supabase init error, falling back to local demo mode:", err);
                this.isDemoMode = true;
            }
        } else {
            this.isDemoMode = true;
            console.log("Running in Local Demo Mode. Configure Supabase in Settings or .env to sync with cloud.");
        }
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    async getCurrentUser() {
        if (!this.isDemoMode && this.client) {
            try {
                const { data: { session } } = await this.client.auth.getSession();
                this.currentUser = session?.user || null;
                return this.currentUser;
            } catch (e) {
                console.error("Error fetching session:", e);
                return null;
            }
        } else {
            const saved = localStorage.getItem('finwise_demo_user');
            this.currentUser = saved ? JSON.parse(saved) : { id: 'demo-user-123', email: 'demo@finwise.local', user_metadata: { full_name: 'Demo Investor' } };
            return this.currentUser;
        }
    }

    async signUp(email, password, fullName) {
        if (!this.isDemoMode && this.client) {
            const { data, error } = await this.client.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });
            if (error) throw error;
            this.currentUser = data.user;
            return data.user;
        } else {
            const demoUser = { id: 'demo-' + Date.now(), email, user_metadata: { full_name: fullName } };
            localStorage.setItem('finwise_demo_user', JSON.stringify(demoUser));
            this.currentUser = demoUser;
            return demoUser;
        }
    }

    async signIn(email, password) {
        if (!this.isDemoMode && this.client) {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            this.currentUser = data.user;
            return data.user;
        } else {
            const demoUser = { id: 'demo-' + Date.now(), email, user_metadata: { full_name: email.split('@')[0] } };
            localStorage.setItem('finwise_demo_user', JSON.stringify(demoUser));
            this.currentUser = demoUser;
            return demoUser;
        }
    }

    async signOut() {
        if (!this.isDemoMode && this.client) {
            await this.client.auth.signOut();
        }
        localStorage.removeItem('finwise_demo_user');
        this.currentUser = null;
    }

    // ==========================================
    // TRANSACTIONS
    // ==========================================

    async getTransactions() {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) return [];
            const { data, error } = await this.client
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        } else {
            return this._getLocalTransactions();
        }
    }

    async addTransaction(tx) {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) {
                if (window.app) window.app.openModal('auth-modal');
                throw new Error("Please Sign In or Create an Account (click the 🔑 icon) to save records to Supabase.");
            }
            const record = {
                user_id: user.id,
                title: tx.title,
                amount: parseFloat(tx.amount),
                type: tx.type,
                category: tx.category,
                date: tx.date || new Date().toISOString().split('T')[0],
                notes: tx.notes || '',
                is_recurring: Boolean(tx.is_recurring)
            };
            const { data, error } = await this.client.from('transactions').insert([record]).select();
            if (error) throw error;
            return data[0];
        } else {
            const list = this._getLocalTransactions();
            const newTx = {
                id: 'tx-' + Date.now(),
                user_id: user ? user.id : 'demo-user',
                title: tx.title,
                amount: parseFloat(tx.amount),
                type: tx.type,
                category: tx.category,
                date: tx.date || new Date().toISOString().split('T')[0],
                notes: tx.notes || '',
                is_recurring: Boolean(tx.is_recurring),
                created_at: new Date().toISOString()
            };
            list.unshift(newTx);
            localStorage.setItem('finwise_local_transactions', JSON.stringify(list));
            return newTx;
        }
    }

    async deleteTransaction(id) {
        if (!this.isDemoMode && this.client) {
            const { error } = await this.client.from('transactions').delete().eq('id', id);
            if (error) throw error;
        } else {
            let list = this._getLocalTransactions();
            list = list.filter(item => item.id !== id);
            localStorage.setItem('finwise_local_transactions', JSON.stringify(list));
        }
    }

    // ==========================================
    // BUDGETS
    // ==========================================

    async getBudgets() {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) return [];
            const { data, error } = await this.client
                .from('budgets')
                .select('*')
                .eq('user_id', user.id);
            if (error) throw error;
            return data || [];
        } else {
            return this._getLocalBudgets();
        }
    }

    async saveBudget(category, monthly_limit) {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) {
                if (window.app) window.app.openModal('auth-modal');
                throw new Error("Please Sign In or Create an Account to manage budgets in Supabase.");
            }
            const { data, error } = await this.client
                .from('budgets')
                .upsert([{ user_id: user.id, category, monthly_limit: parseFloat(monthly_limit) }], { onConflict: 'user_id, category' })
                .select();
            if (error) throw error;
            return data[0];
        } else {
            let list = this._getLocalBudgets();
            const existing = list.find(b => b.category.toLowerCase() === category.toLowerCase());
            if (existing) {
                existing.monthly_limit = parseFloat(monthly_limit);
            } else {
                list.push({
                    id: 'b-' + Date.now(),
                    category,
                    monthly_limit: parseFloat(monthly_limit)
                });
            }
            localStorage.setItem('finwise_local_budgets', JSON.stringify(list));
            return list;
        }
    }

    // ==========================================
    // SAVINGS GOALS
    // ==========================================

    async getGoals() {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) return [];
            const { data, error } = await this.client
                .from('savings_goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } else {
            return this._getLocalGoals();
        }
    }

    async addGoal(goal) {
        if (!this.isDemoMode && this.client) {
            const user = await this.getCurrentUser();
            if (!user) {
                if (window.app) window.app.openModal('auth-modal');
                throw new Error("Please Sign In or Create an Account to save goals in Supabase.");
            }
            const record = {
                user_id: user.id,
                title: goal.title,
                target_amount: parseFloat(goal.target_amount),
                current_amount: parseFloat(goal.current_amount || 0),
                target_date: goal.target_date || null,
                category: goal.category || 'General'
            };
            const { data, error } = await this.client.from('savings_goals').insert([record]).select();
            if (error) throw error;
            return data[0];
        } else {
            const list = this._getLocalGoals();
            const newGoal = {
                id: 'goal-' + Date.now(),
                title: goal.title,
                target_amount: parseFloat(goal.target_amount),
                current_amount: parseFloat(goal.current_amount || 0),
                target_date: goal.target_date || null,
                category: goal.category || 'General'
            };
            list.unshift(newGoal);
            localStorage.setItem('finwise_local_goals', JSON.stringify(list));
            return newGoal;
        }
    }

    async updateGoalProgress(id, addAmount) {
        if (!this.isDemoMode && this.client) {
            const { data, error: fetchErr } = await this.client.from('savings_goals').select('current_amount').eq('id', id).single();
            if (fetchErr) throw fetchErr;
            const updated = (data.current_amount || 0) + parseFloat(addAmount);
            const { error } = await this.client.from('savings_goals').update({ current_amount: updated }).eq('id', id);
            if (error) throw error;
        } else {
            let list = this._getLocalGoals();
            const g = list.find(item => item.id === id);
            if (g) {
                g.current_amount = Math.max(0, (g.current_amount || 0) + parseFloat(addAmount));
                localStorage.setItem('finwise_local_goals', JSON.stringify(list));
            }
        }
    }

    async deleteGoal(id) {
        if (!this.isDemoMode && this.client) {
            const { error } = await this.client.from('savings_goals').delete().eq('id', id);
            if (error) throw error;
        } else {
            let list = this._getLocalGoals();
            list = list.filter(item => item.id !== id);
            localStorage.setItem('finwise_local_goals', JSON.stringify(list));
        }
    }

    // ==========================================
    // LOCAL SEED DATA
    // ==========================================

    _getLocalTransactions() {
        const raw = localStorage.getItem('finwise_local_transactions');
        if (raw) return JSON.parse(raw);
        const seed = [
            { id: 'tx-1', title: 'Salary Direct Deposit', amount: 5200.00, type: 'income', category: 'Salary', date: '2026-09-01', notes: 'Monthly tech salary', is_recurring: true },
            { id: 'tx-2', title: 'Freelance Design Project', amount: 850.00, type: 'income', category: 'Freelance', date: '2026-09-05', notes: 'UI consulting gig', is_recurring: false },
            { id: 'tx-3', title: 'Apartment Rent', amount: 1650.00, type: 'expense', category: 'Housing', date: '2026-09-02', notes: 'Monthly rent', is_recurring: true },
            { id: 'tx-4', title: 'Whole Foods Market', amount: 340.50, type: 'expense', category: 'Groceries', date: '2026-09-04', notes: 'Weekly groceries', is_recurring: false },
            { id: 'tx-5', title: 'Electric & Internet Utility', amount: 180.00, type: 'expense', category: 'Utilities', date: '2026-09-06', notes: 'Fiber broadband & power', is_recurring: true },
            { id: 'tx-6', title: 'Dinner with Friends', amount: 115.00, type: 'expense', category: 'Dining Out', date: '2026-09-08', notes: 'Italian restaurant', is_recurring: false },
            { id: 'tx-7', title: 'Gym Membership', amount: 65.00, type: 'expense', category: 'Health', date: '2026-09-03', notes: 'Fitness club', is_recurring: true },
            { id: 'tx-8', title: 'Car Insurance', amount: 140.00, type: 'expense', category: 'Transport', date: '2026-09-07', notes: 'Auto policy', is_recurring: true },
            { id: 'tx-9', title: 'Netflix & Spotify', amount: 32.00, type: 'expense', category: 'Entertainment', date: '2026-09-02', notes: 'Streaming subscriptions', is_recurring: true }
        ];
        localStorage.setItem('finwise_local_transactions', JSON.stringify(seed));
        return seed;
    }

    _getLocalBudgets() {
        const raw = localStorage.getItem('finwise_local_budgets');
        if (raw) return JSON.parse(raw);
        const seed = [
            { id: 'b-1', category: 'Housing', monthly_limit: 1700.00 },
            { id: 'b-2', category: 'Groceries', monthly_limit: 600.00 },
            { id: 'b-3', category: 'Dining Out', monthly_limit: 350.00 },
            { id: 'b-4', category: 'Utilities', monthly_limit: 220.00 },
            { id: 'b-5', category: 'Transport', monthly_limit: 300.00 },
            { id: 'b-6', category: 'Entertainment', monthly_limit: 150.00 }
        ];
        localStorage.setItem('finwise_local_budgets', JSON.stringify(seed));
        return seed;
    }

    _getLocalGoals() {
        const raw = localStorage.getItem('finwise_local_goals');
        if (raw) return JSON.parse(raw);
        const seed = [
            { id: 'g-1', title: 'Emergency Fund (6 Months)', target_amount: 15000.00, current_amount: 9800.00, target_date: '2026-12-31', category: 'Emergency' },
            { id: 'g-2', title: 'Trip to Tokyo', target_amount: 4500.00, current_amount: 2300.00, target_date: '2027-04-15', category: 'Travel' },
            { id: 'g-3', title: 'MacBook Pro Upgrade', target_amount: 2200.00, current_amount: 1400.00, target_date: '2026-11-30', category: 'Electronics' }
        ];
        localStorage.setItem('finwise_local_goals', JSON.stringify(seed));
        return seed;
    }
}

window.DataService = new DataService();
