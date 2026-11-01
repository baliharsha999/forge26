import { createClient } from '@supabase/supabase-js';

// Supabase Environment Configuration
// When deploying to Supabase, populate these in your .env or deployment environment:
// VITE_SUPABASE_URL=https://your-project-ref.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-public-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Fallback-aware API dispatcher:
 * If Supabase is configured with Edge Functions, dispatches directly to Supabase.
 * Otherwise, gracefully routes to local FastAPI backend.
 */
export async function dispatchCivicQuery(endpoint: string, payload: any) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: payload,
      });
      if (!error && data) return data;
      console.warn(`Supabase function '${endpoint}' returned error, falling back:`, error);
    } catch (e) {
      console.warn(`Supabase invoke failed, falling back to local backend:`, e);
    }
  }

  // Local backend fallback
  const response = await fetch(`http://localhost:8000/api/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return await response.json();
}
