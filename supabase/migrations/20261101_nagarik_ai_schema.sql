-- ============================================================================
-- Nagarik AI Sovereign Civic Knowledge Base & Audit Schema
-- Migration: 20261101_nagarik_ai_schema.sql
-- Description: Core tables, indexes, full-text search, and Row Level Security
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Verified Welfare Schemes Table
CREATE TABLE IF NOT EXISTS public.schemes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Central', 'State')),
    state TEXT DEFAULT 'All-India',
    category TEXT NOT NULL,
    benefit TEXT NOT NULL,
    eligibility_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents_required JSONB NOT NULL DEFAULT '[]'::jsonb,
    official_url TEXT NOT NULL,
    application_mode TEXT DEFAULT 'Online',
    last_verified_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for Fast Query Routing
CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON public.schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_level ON public.schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_name_trgm ON public.schemes USING gin (name gin_trgm_ops);

-- 3. Sovereign Citizen Grievance Registry
CREATE TABLE IF NOT EXISTS public.grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id TEXT UNIQUE NOT NULL,
    portal TEXT NOT NULL DEFAULT 'CPGRAMS',
    department TEXT NOT NULL,
    citizen_name TEXT NOT NULL,
    citizen_phone TEXT NOT NULL,
    district TEXT NOT NULL,
    locality TEXT,
    pincode TEXT,
    grievance_category TEXT NOT NULL,
    grievance_description TEXT NOT NULL,
    relief_sought TEXT,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
    receipt_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grievances_tracking ON public.grievances(tracking_id);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON public.grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_department ON public.grievances(department);

-- 4. Audit & Fact Check Verification Logs
CREATE TABLE IF NOT EXISTS public.fact_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED')),
    official_clarification TEXT NOT NULL,
    source_url TEXT NOT NULL,
    verified_by TEXT NOT NULL DEFAULT 'PIB Fact Check / Sovereign Gazette',
    verified_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_checks_claim_trgm ON public.fact_checks USING gin (claim gin_trgm_ops);

-- 5. Full-Text Search Function for Scheme Discovery
CREATE OR REPLACE FUNCTION public.search_schemes(
    query_text TEXT,
    target_state TEXT DEFAULT 'All-India'
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    department TEXT,
    level TEXT,
    state TEXT,
    benefit TEXT,
    eligibility_criteria JSONB,
    documents_required JSONB,
    official_url TEXT,
    last_verified_date DATE,
    rank REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        s.id,
        s.name,
        s.department,
        s.level,
        s.state,
        s.benefit,
        s.eligibility_criteria,
        s.documents_required,
        s.official_url,
        s.last_verified_date,
        ts_rank_cd(
            to_tsvector('english', s.name || ' ' || s.benefit || ' ' || s.department || ' ' || s.category),
            plainto_tsquery('english', query_text)
        ) AS rank
    FROM public.schemes s
    WHERE 
        (s.state = 'All-India' OR target_state = 'All-India' OR LOWER(s.state) = LOWER(target_state))
        AND (
            to_tsvector('english', s.name || ' ' || s.benefit || ' ' || s.department || ' ' || s.category) @@ plainto_tsquery('english', query_text)
            OR s.name ILIKE '%' || query_text || '%'
            OR s.benefit ILIKE '%' || query_text || '%'
        )
    ORDER BY rank DESC, s.name ASC
    LIMIT 10;
$$;

-- 6. Row Level Security (RLS) Policies
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_checks ENABLE ROW LEVEL SECURITY;

-- 6.1 Public can read all verified schemes
CREATE POLICY "Allow public read on schemes" ON public.schemes
    FOR SELECT USING (true);

-- 6.2 Grievance Security & Citizen Privacy (Hardened):
-- Bulk enumeration of citizen records is strictly blocked.
-- A citizen can ONLY retrieve their own grievance record by supplying the exact matching tracking_id.
CREATE POLICY "Allow tracking-id scoped read on grievances" ON public.grievances
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        (NULLIF(current_setting('request.headers', true)::json->>'x-tracking-id', '') IS NOT NULL AND 
         tracking_id = current_setting('request.headers', true)::json->>'x-tracking-id')
    );

-- Citizens can insert new grievances with validated contact data
CREATE POLICY "Allow validated insert on grievances" ON public.grievances
    FOR INSERT WITH CHECK (
        citizen_phone IS NOT NULL AND length(citizen_phone) >= 10 AND
        citizen_name IS NOT NULL AND length(trim(citizen_name)) > 0
    );

-- 6.3 Public can read fact checks
CREATE POLICY "Allow public read on fact_checks" ON public.fact_checks
    FOR SELECT USING (true);
