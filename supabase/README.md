# 🏛️ Nagarik AI — Supabase Deployment Architecture

This directory contains the production-ready Supabase deployment assets for **Nagarik AI**, including PostgreSQL DDL with `pgvector` semantic matching, Deno Edge Functions, and seed scripts.

---

## 📁 Architecture Overview

```
supabase/
├── config.toml                            # Supabase CLI project configuration
├── migrations/
│   └── 20261101_nagarik_ai_schema.sql     # PostgreSQL DDL, pgvector extension, RLS, and match_schemes RPC
├── seed.sql                               # 100% Hand-verified Central and State schemes seed data
├── seed.py                                # Generator script for seeding verified schemes
└── functions/
    ├── chat/index.ts                      # Serverless Edge Function for Sovereign Civic RAG
    └── eligibility/index.ts               # Serverless Edge Function for Citizen Entitlement Engine
```

---

## 🚀 Deployment Steps (Via Supabase CLI or Dashboard)

### Option 1: 1-Click via Supabase CLI

1. **Login to Supabase**:
   ```bash
   npx supabase login
   ```

2. **Link to your Supabase Project**:
   ```bash
   npx supabase link --project-ref <YOUR_PROJECT_REF>
   ```

3. **Push Database Schema & Migrations**:
   ```bash
   npx supabase db push
   ```

4. **Seed Verified Schemes Data**:
   ```bash
   npx supabase db reset  # Or run seed.sql directly via Supabase SQL Editor
   ```

5. **Deploy Edge Functions**:
   ```bash
   # Set Groq API Key Secret for Edge Functions
   npx supabase secrets set GROQ_API_KEY="<YOUR_GROQ_API_KEY>"

   # Deploy the functions
   npx supabase functions deploy chat --no-verify-jwt
   npx supabase functions deploy eligibility --no-verify-jwt
   ```

---

### Option 2: Via Supabase Web Dashboard (Zero Install)

1. Open your project on [database.new](https://database.new) or [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> Click **New Query**.
3. Copy and paste the contents of `supabase/migrations/20261101_nagarik_ai_schema.sql` and run it.
4. Copy and paste `supabase/seed.sql` and run it to populate all 16+ verified central & state schemes with gazette citations.
5. In **Project Settings** -> **API**, copy your `Project URL` and `anon public key`.
6. Add them to `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
7. Run `npm run build` to deploy the frontend to Vercel, Netlify, or Cloudflare Pages.

---

## 🛡️ Database Features

- **pgvector Cosine Search**: `public.match_schemes(query_embedding, match_threshold, match_count, filter_state)`
- **Full Text Search**: GIN indexes on scheme titles, benefits, and statutory bodies.
- **Row-Level Security (RLS)**: Public read-only access on verified regulations, authenticated/public write access on grievances.
