/**
 * FinWise Global Configuration
 * 
 * Central configuration: Set your Supabase & Gemini credentials ONCE here,
 * and every visitor/user will automatically have access to your database and AI chatbot!
 */

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
    // =========================================================================
    // 🌐 GLOBAL MASTER KEYS (Configured ONCE for all users)
    // Paste your credentials here and push to GitHub — all users inherit them!
    // =========================================================================
    GLOBAL_SUPABASE_URL: '',
    GLOBAL_SUPABASE_ANON_KEY: '',
    GLOBAL_GEMINI_API_KEY: '',

    // Active credentials with fallback to Global Master Keys
    get SUPABASE_URL() {
        return localStorage.getItem('finwise_supabase_url') || this.GLOBAL_SUPABASE_URL;
    },
    set SUPABASE_URL(val) {
        if (val) localStorage.setItem('finwise_supabase_url', val);
    },

    get SUPABASE_ANON_KEY() {
        return localStorage.getItem('finwise_supabase_anon_key') || this.GLOBAL_SUPABASE_ANON_KEY;
    },
    set SUPABASE_ANON_KEY(val) {
        if (val) localStorage.setItem('finwise_supabase_anon_key', val);
    },

    get GEMINI_API_KEY() {
        return localStorage.getItem('finwise_gemini_key') || this.GLOBAL_GEMINI_API_KEY;
    },
    set GEMINI_API_KEY(val) {
        if (val) localStorage.setItem('finwise_gemini_key', val);
    },

    // Backend API URL: Local or cloud
    BACKEND_URL: localStorage.getItem('finwise_backend_url') || (isLocalhost ? 'http://127.0.0.1:8000' : window.location.origin),

    // Currency symbol
    CURRENCY: '$',

    isSupabaseConfigured() {
        const url = this.SUPABASE_URL;
        const key = this.SUPABASE_ANON_KEY;
        return (
            url && 
            key && 
            !url.includes('your-project') &&
            !key.includes('your-anon-key')
        );
    },

    async syncWithBackend() {
        try {
            const resp = await fetch(`${this.BACKEND_URL.replace(/\/$/, '')}/api/public-config`, {
                headers: { 'Accept': 'application/json' }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.supabase_url && data.supabase_anon_key && !this.GLOBAL_SUPABASE_URL) {
                    this.GLOBAL_SUPABASE_URL = data.supabase_url;
                    this.GLOBAL_SUPABASE_ANON_KEY = data.supabase_anon_key;
                }
            }
        } catch (e) {
            // Standalone client mode
        }
    },

    saveSettings({ supabaseUrl, supabaseAnonKey, backendUrl, geminiKey }) {
        if (supabaseUrl !== undefined) {
            this.SUPABASE_URL = supabaseUrl.trim();
        }
        if (supabaseAnonKey !== undefined) {
            this.SUPABASE_ANON_KEY = supabaseAnonKey.trim();
        }
        if (backendUrl !== undefined) {
            this.BACKEND_URL = backendUrl.trim();
            localStorage.setItem('finwise_backend_url', this.BACKEND_URL);
        }
        if (geminiKey !== undefined) {
            this.GEMINI_API_KEY = geminiKey.trim();
        }
    }
};

window.CONFIG = CONFIG;
