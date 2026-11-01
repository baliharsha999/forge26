-- ============================================================================
-- NAGARIK AI - SOVEREIGN CIVIC INTELLIGENCE SUPABASE SCHEMA
-- Enables pgvector extension, verified schemes table, grievances ledger,
-- viral fact checks, and semantic cosine vector similarity search function.
-- ============================================================================

-- 1. Enable pgvector Extension for Semantic RAG Search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Schemes & Gazettes Table (Grounded in 5,210 Central & State Schemes)
CREATE TABLE IF NOT EXISTS public.schemes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Government of India',
    level TEXT NOT NULL DEFAULT 'central', -- 'central' | 'state'
    state TEXT NOT NULL DEFAULT 'All-India',
    category TEXT NOT NULL DEFAULT 'general',
    benefit TEXT NOT NULL,
    eligibility_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents_required JSONB NOT NULL DEFAULT '[]'::jsonb,
    how_to_apply TEXT NOT NULL DEFAULT '',
    official_url TEXT NOT NULL DEFAULT 'https://myscheme.gov.in',
    source_text TEXT NOT NULL DEFAULT '',
    last_verified_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_provider TEXT NOT NULL DEFAULT 'local_verified',
    embedding vector(384), -- Compatible with all-MiniLM-L6-v2 / BGE-small / Groq Embeddings
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on Scheme Search & State filtering
CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON public.schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_name ON public.schemes USING gin(to_tsvector('english', name || ' ' || benefit));

-- 3. Civic Grievances Table (Audit Ledger & SLA Tracking)
CREATE TABLE IF NOT EXISTS public.grievances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id TEXT UNIQUE NOT NULL,
    citizen_name TEXT NOT NULL,
    citizen_phone TEXT NOT NULL,
    citizen_district TEXT NOT NULL,
    citizen_locality TEXT NOT NULL,
    department TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency_level TEXT NOT NULL DEFAULT 'Medium',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Review', -- 'Pending Review' | 'In Progress' | 'Resolved' | 'Overdue'
    days_elapsed INT NOT NULL DEFAULT 0,
    estimated_sla_days INT NOT NULL DEFAULT 7,
    assigned_officer TEXT DEFAULT 'Zonal Grievance Officer',
    verification_hash TEXT NOT NULL,
    receipt_screenshot TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on Grievances for fast Tracking ID Lookup
CREATE INDEX IF NOT EXISTS idx_grievances_tracking_id ON public.grievances(tracking_id);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON public.grievances(status);

-- 4. 3-Outcome Civic Claim Verifier Table
CREATE TABLE IF NOT EXISTS public.fact_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim TEXT NOT NULL,
    outcome TEXT NOT NULL, -- 'matches' | 'contradicts' | 'unverified'
    verdict TEXT NOT NULL,
    truth_score INT NOT NULL DEFAULT 0,
    summary TEXT NOT NULL,
    exact_source_text TEXT NOT NULL,
    official_source_url TEXT NOT NULL,
    action_advice TEXT NOT NULL,
    last_verified_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Semantic Vector Search Function (RPC: match_schemes)
CREATE OR REPLACE FUNCTION public.match_schemes(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_state text DEFAULT 'All-India'
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    department TEXT,
    level TEXT,
    state TEXT,
    benefit TEXT,
    eligibility_criteria JSONB,
    official_url TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.department,
        s.level,
        s.state,
        s.benefit,
        s.eligibility_criteria,
        s.official_url,
        1 - (s.embedding <=> query_embedding) AS similarity
    FROM public.schemes s
    WHERE (
        s.embedding IS NOT NULL
        AND (filter_state = 'All-India' OR s.state = filter_state OR s.state = 'All-India')
        AND (1 - (s.embedding <=> query_embedding)) > match_threshold
    )
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Row Level Security (RLS) Policies
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_checks ENABLE ROW LEVEL SECURITY;

-- Public can read all verified schemes
CREATE POLICY "Allow public read on schemes" ON public.schemes
    FOR SELECT USING (true);

-- Public can read and submit grievances
CREATE POLICY "Allow public read on grievances" ON public.grievances
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on grievances" ON public.grievances
    FOR INSERT WITH CHECK (true);

-- Public can read fact checks
CREATE POLICY "Allow public read on fact_checks" ON public.fact_checks
    FOR SELECT USING (true);
