# 📈 FinWise — Financial Tracker & AI Scenario Advisor

A modern, responsive personal finance tracking and management tool built with **HTML5, CSS3, JavaScript**, a **Python (FastAPI)** backend, **Supabase** for database & authentication, and an integrated **AI Financial Advisor** powered by **Google Gemini** for evaluating "What-If" purchase and goal scenarios.

---

## 🌟 Key Features

- **Personal Finance Dashboard**:
  - Real-time income, expense, net savings, and savings rate calculations.
  - Interactive **Chart.js** visualizations: Spending breakdown doughnut chart & cash flow trend bars.
  - Recent activity timeline and full transaction history table with categorization, filtering, and search.
- **Budgets & Savings Goals Tracker**:
  - Set monthly category limits with dynamic progress bars (turns yellow at 80%, red over 100%).
  - Define savings goals with milestone progress bars and "+ Add Funds" quick action.
- **🤖 AI Financial Advisor ("FinWise AI")**:
  - Live access to the user's financial snapshot (income, expenses, budgets, savings goals).
  - **"What-If" Scenario Simulator**: Evaluates questions like *"If I buy an iPhone 16 Pro for $1,199, how will it affect my goals?"*
  - Calculates mathematical affordability scores (0–100), risk levels, savings reduction %, and exact delays on active savings goals (+X months).
  - Provides actionable budgeting advice and alternatives.
- **Supabase Cloud + Local Demo Mode**:
  - Works immediately out-of-the-box in **Local Demo Mode** (persists in browser storage) so you can test right away.
  - Connects to your **Supabase** project for cloud sync, user authentication (Sign Up / Sign In), and PostgreSQL Row-Level Security (RLS).
- **Deployment Ready**:
  - Configured for **Vercel** (`vercel.json`) and **Netlify** (`netlify.toml`).
  - Backend ready for **Render**, **Railway**, or local server with `Procfile`.

---

## 🏗️ Project Architecture

```
MUJ HACKX4/
├── frontend/
│   ├── index.html              # Main single-page application
│   ├── css/
│   │   ├── style.css           # Modern fintech styling & responsive layout
│   │   └── components.css      # Modals, chat drawer, badges, progress bars
│   └── js/
│       ├── config.js           # API endpoints & credentials manager
│       ├── supabaseClient.js   # Supabase Auth & Database client layer
│       ├── charts.js           # Chart.js visualizations
│       ├── app.js              # Application state & dashboard logic
│       └── chat.js             # AI Chatbot & Scenario Simulator UI
├── backend/
│   ├── main.py                 # FastAPI app, CORS, and routing
│   ├── config.py               # Backend settings
│   ├── models.py               # Pydantic data schemas
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Environment variables template
│   ├── Procfile                # Production deployment procfile
│   └── services/
│       ├── scenario_engine.py  # Mathematical What-If simulation engine
│       └── ai_advisor.py       # Google Gemini prompt engine with financial context
├── supabase/
│   └── schema.sql              # Supabase PostgreSQL tables, RLS policies, and triggers
├── vercel.json                 # Vercel deployment configuration
├── netlify.toml                # Netlify deployment configuration
├── .gitignore                  # Git ignore rules
└── README.md                   # Documentation & Setup Guide
```

---

## 🚀 Quick Start (Local Setup)

### 1. Start the Python Backend
Open a terminal in the project root:

```bash
# Optional: create a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start the FastAPI server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now running at `http://127.0.0.1:8000`. You can test the interactive API docs at `http://127.0.0.1:8000/docs`.

### 2. Run the Frontend
You can open `frontend/index.html` directly in your browser or run a lightweight local static server:

```bash
# Using Python's built-in HTTP server:
python -m http.server 5500 --directory frontend
```
Now visit **`http://127.0.0.1:5500`** in your browser!

---

## 🗄️ Setting Up Supabase Database & Auth

1. Go to [supabase.com](https://supabase.com) and create a free account & project.
2. In your Supabase Project Dashboard:
   - Navigate to the **SQL Editor** tab.
   - Open `supabase/schema.sql` from this repository, copy the entire SQL script, and paste it into the editor.
   - Click **Run**. This will create the `profiles`, `transactions`, `budgets`, and `savings_goals` tables with Row-Level Security (RLS) enabled.
3. In your Supabase Project Dashboard, go to **Project Settings** > **API**:
   - Copy the **Project URL** (`https://xyzcompany.supabase.co`).
   - Copy the **anon public key** (`eyJhbGci...`).
4. In the FinWise app in your browser:
   - Click **Settings & API** in the sidebar (or top right).
   - Enter your `Supabase Project URL` and `Supabase Anon Public Key`.
   - Click **Save & Apply**. The app will now automatically sync all data directly to Supabase!
   - You can now click the key icon (🔑) in the sidebar to Sign Up / Sign In.

---

## 🤖 Setting Up the Google Gemini AI Chatbot

1. Go to [Google AI Studio](https://aistudio.google.com/) and generate a free **Gemini API Key**.
2. You can provide this key in either of two ways:
   - **Method A (In-App Settings)**: Click **Settings & API** in FinWise and paste your Gemini API key in the field.
   - **Method B (Backend .env)**: Create a `.env` file in the `backend/` directory:
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
3. *Note: If no API key is provided, the advisor runs in **Smart Deterministic Fallback Mode**, still calculating exact numbers, goal delays, and affordability scores!*

---

## 📤 Push to GitHub

To upload this repository to GitHub:

```bash
# Initialize and stage files (if not already done)
git add .
git commit -m "feat: Initial commit of FinWise Financial Tracker & AI Scenario Advisor"

# Link to your GitHub repository
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git branch -M main
git push -u origin main
```

---

## 🌐 Deployment to Vercel or Netlify

### Option A: Vercel (Frontend)
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your GitHub repository.
3. Vercel will automatically detect `vercel.json`.
4. Set **Root Directory** or verify `Publish Directory` is set to `frontend`.
5. Click **Deploy**.

### Option B: Netlify (Frontend)
1. Go to [netlify.com](https://netlify.com) and click **"Add new site"** > **"Import an existing project"**.
2. Select your GitHub repository.
3. Netlify will detect `netlify.toml` and set the publish directory to `frontend`.
4. Click **Deploy site**.

### Backend Deployment (Render or Railway)
1. Go to [render.com](https://render.com) and create a new **Web Service**.
2. Connect your GitHub repository.
3. Select **Python** runtime.
4. Set **Build Command**: `pip install -r backend/requirements.txt`
5. Set **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
7. Click **Create Web Service**.
8. Once deployed, copy your Render URL (e.g. `https://finwise-api.onrender.com`) and paste it into the FinWise frontend settings!

---

## 🧪 Testing the What-If Chatbot

Try asking questions like:
- *"If I buy an iPhone 16 Pro for $1,199 now, how will it affect my goals?"*
- *"Can I afford a $2,500 vacation next month?"*
- *"What happens if I finance a $400/month car for 24 months?"*
- *"How can I cut $300 from my monthly expenses to accelerate my emergency fund?"*

The system computes:
1. Impact on monthly net cashflow.
2. Percentage reduction in savings rate.
3. Exact timeline slip (+X months) on your active goals (e.g. Emergency Fund or Vacation).
4. Affordability Score (0-100) with a risk assessment badge.
