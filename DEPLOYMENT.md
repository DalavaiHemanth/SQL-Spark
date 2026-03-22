# Deploying SQL Spark (Free)

## Option 1: Vercel (Recommended — Easiest)

### Steps:
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
3. Click **"New Project"** → Import your SQL Spark repo
4. Set **Framework Preset** to `Vite`
5. Add Environment Variables:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
6. Click **Deploy**

Your app will be live at `https://your-project.vercel.app`

### Auto-deploys
Every push to `main` branch will auto-deploy.

---

## Option 2: Netlify (Also Free)

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com) → Sign in with GitHub
3. Click **"Add new site"** → Import from Git
4. Set build command: `npm run build`
5. Set publish directory: `dist`
6. Add env vars (same as above)
7. Deploy

### Important: Add `_redirects` file
Create `public/_redirects` with:
```
/*    /index.html   200
```
This ensures client-side routing works.

---

## Option 3: GitHub Pages (Free but limited)

Not recommended for SPAs with client-side routing unless you add a 404.html redirect hack.

---

## Supabase (Already Free Tier)
- Your database is already on Supabase's free tier
- Free tier includes: 500MB database, 50K monthly active users, 2GB bandwidth
- No changes needed

## Free Tier Limits Summary

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth/month, serverless functions |
| Netlify | 100GB bandwidth/month, 300 build minutes |
| Supabase | 500MB DB, 50K MAU, 2GB bandwidth |
| Total cost | **$0** |

## Pre-deployment Checklist
- [ ] Remove demo admin credentials from Login page (or disable auto-fill)
- [ ] Verify all Supabase schema migrations are run
- [ ] Test with real Supabase credentials
- [ ] Set Supabase Auth email templates
