# ⚡ SQL Spark

**SQL Spark** is a real-time, interactive hackathon platform built specifically for SQL-based challenges and tournaments. It empowers organizers to host, manage, and evaluate competitive database challenges seamlessly, featuring robust anti-cheat enforcement, live leaderboards, and an integrated in-browser SQL execution engine.

---

## 🚀 Features

* **In-Browser SQL Execution**: Powered by `sql.js`, participants can execute queries against SQLite databases (`.db` or `.sqlite`) or raw SQL schemas directly within their browser — zero local database setup required.
* **Strict Anti-Cheat System**: Integrated violation tracking ensures fair play. The system monitors full-screen exits, tab-switching, and clipboard pasting, with live real-time sync across devices via Supabase. Admins receive instant alerts and have full "Forgive" or "Disqualify" control.
* **Dynamic Database Library**: Admins can construct challenges using explicit schema entry, direct `.sqlite` uploads, or pick from an intelligent, reusable Public/Private Database Library. 
* **Real-time Leaderboards & Sync**: Powered by Supabase Realtime subscriptions, tracking submissions, violations, and scores live across the entire application.
* **Intelligent Auto-Evaluation**: Admins can write a "Solution Query" during problem creation, and SQL Spark will automatically generate the expected JSON output. Participant queries are immediately validated against this expected output upon submission.
* **Role-Based Access Control (RBAC)**: Distinct, secure dashboard interfaces for Participants, Organizers, and overarching system Admins.
* **Team & Roster Management**: Supports single-participant and multi-participant teams via unique Join Codes or bulk CSV imports.

---

## 🛠️ Technology Stack

* **Frontend**: React.js, Vite
* **Styling & UI**: Tailwind CSS, Radix UI Components, Framer Motion (Animations), Lucide React (Icons)
* **Backend Database & Auth**: Supabase (PostgreSQL, Realtime, Edge Functions)
* **Database Engine**: WebAssembly-powered `sql.js`
* **Code Editor**: Monaco Editor (via `@monaco-editor/react`)

---

## ⚙️ Local Development Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/en) (v18 or higher recommended)
* `npm` or `yarn`

### 2. Clone the Repository
```bash
git clone https://github.com/yourusername/sql-spark.git
cd sql-spark
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Variables
Create a `.env` file in the root directory and configure your Supabase instance:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*(Note: Your `.env` file is safely ignored by `.gitignore` and will not be committed to GitHub).*

### 5. Run the Local Development Server
```bash
npm run dev
```

The application will start locally (usually on `http://localhost:5173`).

---

## ☁️ Deployment (Vercel / Netlify)

SQL Spark is a Vite SPA. Deploying it is incredibly straight-forward:
1. Connect this repository to your Vercel or Netlify account.
2. Ensure the Framework Preset is set to **Vite**.
3. Set your Build Command to `npm run build` and your Output Directory to `dist`.
4. Inject your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` secrets into the Environment Variables dashboard of your hosting provider.
5. Deploy! Wait ~60 seconds, and your live URL will be ready. 

*(A `public/_redirects` file is intrinsically included to handle correct client-side routing on Netlify).*

---

## 🛡️ License
MIT License. Feel free to fork, build, and host your own SQL challenges!
