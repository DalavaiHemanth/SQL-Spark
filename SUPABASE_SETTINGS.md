# Supabase Concurrency Settings Guide

If you have 10+ participants on the same network (Wi-Fi), you **MUST** increase these limits in your Supabase Dashboard to prevent "stuck" logins.

### 1. Increase Auth Rate Limits
Supabase defaults are often too low for a classroom or lab environment.
1. Go to your **Supabase Dashboard**.
2. Navigate to **Settings** → **Authentication**.
3. Scroll down to **Rate Limits**.
4. Increase **Events per minute per IP** from Default to **100** (or higher).
5. Ensure **Sign In** and **Sign Up** limits are high enough for your total student count.

### 2. Monitor Database Connections
If the site still feels slow:
1. Go to **Settings** → **Database**.
2. Check your **Connection Pooler** settings.
3. Ensure you are using **Transaction mode** for high concurrency.

---

### How to apply the Performance Fixes:
1. **SQL Editor**: Copy the contents of `performance_migration.sql` (found in your project root) and run it in the Supabase SQL Editor.
2. **Deploy**: Push the new code changes I just made to your deployment (Vercel/Netlify/etc.).

These two steps combined will resolve the "stuck" behavior and allow at least 100+ concurrent users.
