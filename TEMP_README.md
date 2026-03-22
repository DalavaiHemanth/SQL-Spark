# SQL Spark — Interactive SQL Hackathon Platform

## 📖 Overview
**SQL Spark** is a self-contained, real-time SQL hackathon platform built to facilitate interactive database challenges. Organizers can create hackathons, define SQL challenges with varying difficulties, and manage participants. Participants can form teams, write SQL queries directly in the browser, and receive instant automated evaluations of their code. 

## ✨ Key Features
- **Hackathon Management**: Complete lifecycle management for SQL hackathons (start, pause, conclude).
- **Team Formation & Management**: Participants can create teams, generate invite codes, and manage team members.
- **In-Browser SQL Execution**: Utilizes `sql.js` to run real SQLite queries entirely client-side without burdening a backend server.
- **Automated Query Evaluation**: Compares participant query results against expected results for instant feedback.
- **Live Leaderboards**: Real-time scoring and ranking based on challenge completion time and accuracy.
- **Gamification & Analytics**: Includes visual charts (via Recharts) and 3D visual elements (via Three.js).
- **Certificate Generation**: Automated generation of completion and winner certificates using `html2canvas` and `jspdf`.
- **Email Notifications**: Integration with Resend for sending out certificates and updates.
- **Interactive Challenges**: Supports multiple rounds, difficulty levels, and hints.
- **Modern UI & Animations**: Smooth animations with Framer Motion and accessible components via Radix UI.
- **Mock Mode / Offline Testing**: Can run entirely offline using the browser's `localStorage` if Supabase credentials are not provided.

## 🛠️ Tech Stack

### Frontend Core
- **Framework**: React 18 + Vite
- **Routing**: React Router DOM
- **State & Data Fetching**: TanStack React Query (`@tanstack/react-query`)
- **Forms & Validation**: React Hook Form with Zod schema validation
- **Styling**: Tailwind CSS, `tailwind-merge`, `clsx`

### UI / UX & Components
- **Component Library**: Radix UI (Headless accessible components) & shadcn/ui
- **Icons**: Lucide React
- **Animations**: Framer Motion, Tailwindcss-animate
- **Notifications**: Sonner, Radix Toast
- **Drag & Drop**: `@hello-pangea/dnd`
- **Rich Text Editor**: React Quill, React Markdown

### Database & Backend Services
- **Backend as a Service (BaaS)**: Supabase (Authentication, PostgreSQL Database, Row Level Security)
- **Client-Side Database**: `sql.js` (SQLite port to WebAssembly for browser-based query execution)

### Integrations & Utilities
- **Data Visualization**: Recharts (charts), React Leaflet (maps), Three.js (3D graphics)
- **Document Generation**: `jspdf` (PDF creation), `html2canvas` (DOM to image)
- **Email Delivery**: Resend
- **Payment (Optional/Future)**: Stripe integration pre-configured
- **Utility Libraries**: `date-fns` & `moment` for dates, `lodash`

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "SQL SPARK"
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

### Environment Configuration
Create a `.env` file in the root directory based on `.env.example`.
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
*(If no `.env` file is present, the app safely falls back to a self-contained Mock Mode.)*

### Running the Development Server
```bash
npm run dev
```

## 🚢 Deployment Options
SQL Spark is optimized to be deployed easily on free-tier hosting services since the heavy lifting (SQL execution) is done client-side.
- **Vercel / Netlify**: Recommended for the React/Vite frontend. Ensure SPA routing is configured (e.g., `_redirects` file for Netlify).
- **Supabase**: Handles all auth and persistent database needs. The Supabase Free Tier easily covers initial requirements.

For detailed deployment strategies, view `DEPLOYMENT.md`.

## 🔐 Default Admin Credentials (Mock Mode)
When running off of Local Storage automatically in development (without Supabase setup):
- **Email:** `admin@sqlspark.com`
- **Password:** `admin123`
