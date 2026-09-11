/**
 * FinWise Global Configuration
 * 
 * Auto-detects environment (Local vs Vercel/Cloud), fetches public configs
 * from the backend, and allows browser override in Settings.
 */

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
    // Supabase Credentials
    SUPABASE_URL: localStorage.getItem('finwise_supabase_url') || '',
    SUPABASE_ANON_KEY: localStorage.getItem('finwise_supabase_anon_key') || '',

    // Backend API URL:
    // If running on Vercel/Cloud on the same domain, use origin.
    // If running on local static server (e.g. port 5500), default to http://127.0.0.1:8000
    BACKEND_URL: localStorage.getItem('finwise_backend_url') || (isLocalhost ? 'http://127.0.0.1:8000' : window.location.origin),

    // Optional user-supplied Gemini / OpenAI API key
    GEMINI_API_KEY: localStorage.getItem('finwise_gemini_key') || '',

    // Currency symbol
    CURRENCY: '$',

    isSupabaseConfigured() {
        return (
            this.SUPABASE_URL && 
            this.SUPABASE_ANON_KEY && 
            !this.SUPABASE_URL.includes('your-project') &&
            !this.SUPABASE_ANON_KEY.includes('your-anon-key')
        );
    },

    /**
     * Auto-fetches backend public configuration (Supabase URL & Anon Key from .env).
     * This eliminates the need for manual copy-pasting in the browser!
     */
    async syncWithBackend() {
        try {
            const resp = await fetch(`${this.BACKEND_URL.replace(/\/$/, '')}/api/public-config`, {
                headers: { 'Accept': 'application/json' }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.supabase_url && data.supabase_anon_key && !this.SUPABASE_URL) {
                    this.SUPABASE_URL = data.supabase_url;
                    this.SUPABASE_ANON_KEY = data.supabase_anon_key;
                    console.log("Auto-loaded Supabase credentials from backend .env.");
                }
            }
        } catch (e) {
            console.log("Backend offline or running in standalone mode:", e.message);
        }
    },

    saveSettings({ supabaseUrl, supabaseAnonKey, backendUrl, geminiKey }) {
        if (supabaseUrl !== undefined) {
            this.SUPABASE_URL = supabaseUrl.trim();
            localStorage.setItem('finwise_supabase_url', this.SUPABASE_URL);
        }
        if (supabaseAnonKey !== undefined) {
            this.SUPABASE_ANON_KEY = supabaseAnonKey.trim();
            localStorage.setItem('finwise_supabase_anon_key', this.SUPABASE_ANON_KEY);
        }
        if (backendUrl !== undefined) {
            this.BACKEND_URL = backendUrl.trim();
            localStorage.setItem('finwise_backend_url', this.BACKEND_URL);
        }
        if (geminiKey !== undefined) {
            this.GEMINI_API_KEY = geminiKey.trim();
            localStorage.setItem('finwise_gemini_key', this.GEMINI_API_KEY);
        }
    }
};

window.CONFIG = CONFIG;
