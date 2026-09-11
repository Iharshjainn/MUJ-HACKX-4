/**
 * FinWise Global Configuration
 * 
 * You can set your Supabase credentials and Backend API URL here,
 * OR configure them dynamically in the App's "Settings" modal in the browser.
 */

const CONFIG = {
    // Supabase Credentials
    // Replace these or configure them in the in-app Settings dialog
    SUPABASE_URL: localStorage.getItem('finwise_supabase_url') || 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: localStorage.getItem('finwise_supabase_anon_key') || 'your-anon-key-here',

    // Python FastAPI Backend API URL
    // When running locally, typically http://127.0.0.1:8000
    // When deployed (e.g. on Render/Railway), update this to your backend domain
    BACKEND_URL: localStorage.getItem('finwise_backend_url') || 'http://127.0.0.1:8000',

    // Optional user-supplied Gemini API key for AI Chatbot
    GEMINI_API_KEY: localStorage.getItem('finwise_gemini_key') || '',

    // Currency symbol and format
    CURRENCY: '$',

    // Checks if valid Supabase credentials have been configured
    isSupabaseConfigured() {
        return (
            this.SUPABASE_URL && 
            this.SUPABASE_ANON_KEY && 
            !this.SUPABASE_URL.includes('your-project') &&
            !this.SUPABASE_ANON_KEY.includes('your-anon-key')
        );
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
