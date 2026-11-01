import json
import os

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
schemes_json_path = os.path.join(base_dir, "data", "schemes.json")
seed_sql_path = os.path.join(base_dir, "supabase", "seed.sql")

with open(schemes_json_path, "r", encoding="utf-8") as f:
    schemes = json.load(f)

lines = [
    "-- ============================================================================",
    "-- NAGARIK AI - VERIFIED SCHEMES SEED DATA",
    "-- ============================================================================\n"
]

for s in schemes:
    s_id = s.get("id", "").replace("'", "''")
    name = s.get("name", "").replace("'", "''")
    dept = s.get("department", "Government of India").replace("'", "''")
    level = s.get("level", "central").replace("'", "''")
    state = s.get("state", "All-India").replace("'", "''")
    category = s.get("category", "general").replace("'", "''")
    benefit = s.get("benefit", "").replace("'", "''")
    criteria = json.dumps(s.get("eligibility_criteria", [])).replace("'", "''")
    docs = json.dumps(s.get("documents_required", [])).replace("'", "''")
    how = s.get("how_to_apply", "").replace("'", "''")
    url = s.get("official_url", "https://myscheme.gov.in").replace("'", "''")
    src = s.get("source_text", "").replace("'", "''")
    verified = s.get("last_verified_date", "2026-10-31")

    sql = f"""INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('{s_id}', '{name}', '{dept}', '{level}', '{state}', '{category}', '{benefit}', '{criteria}'::jsonb, '{docs}'::jsonb, '{how}', '{url}', '{src}', '{verified}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;
"""
    lines.append(sql)

with open(seed_sql_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Generated seed.sql with {len(schemes)} verified schemes!")
