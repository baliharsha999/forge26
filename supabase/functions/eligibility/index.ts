import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EligibilityRequest {
  occupation?: string;
  annual_income?: number;
  gender?: string;
  age?: number;
  landholder?: boolean;
  state?: string;
  has_school_children?: boolean;
  caste?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EligibilityRequest = await req.json();
    
    // Explicit Inputs Only - DO NOT assume default farmer, landholder, or income
    const occupation = body.occupation ? body.occupation.trim().toLowerCase() : null;
    const annual_income = typeof body.annual_income === "number" ? body.annual_income : null;
    const gender = body.gender ? body.gender.trim().toLowerCase() : null;
    const age = typeof body.age === "number" ? body.age : null;
    const landholder = typeof body.landholder === "boolean" ? body.landholder : null;
    const state = body.state ? body.state.trim() : "All-India";
    const has_school_children = typeof body.has_school_children === "boolean" ? body.has_school_children : null;
    const caste = body.caste ? body.caste.trim().toLowerCase() : null;

    // Identify missing core criteria
    const missingFields: string[] = [];
    if (!occupation) missingFields.push("occupation");
    if (annual_income === null) missingFields.push("annual_income");
    if (age === null) missingFields.push("age");
    if (landholder === null) missingFields.push("landholder");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: allSchemes } = await supabase
      .from("schemes")
      .select("*");

    const stateNorm = state.toLowerCase();
    const likelyMatches: any[] = [];

    for (const s of (allSchemes || [])) {
      const matchReasons: string[] = [];
      const sState = (s.state || "All-India").toLowerCase();

      if (sState !== "all-india" && stateNorm !== "all-india" && sState !== stateNorm) {
        continue;
      }

      // 1. Thalliki Vandanam (AP school child assistance)
      if (s.id === "SCHEME-016" && has_school_children === true) {
        if (["all-india", "andhra pradesh", "ap"].includes(stateNorm)) {
          matchReasons.push("Eligible for ₹15,000/yr DBT per school-going child in Andhra Pradesh");
        }
      }

      // 2. PM-KISAN (Requires verified landholder + farmer occupation)
      if (s.id === "SCHEME-001") {
        if (landholder === true && occupation === "farmer") {
          matchReasons.push("Eligible cultivable landholding farmer for ₹6,000/yr DBT in 3 installments");
        }
      }

      // 3. YSR Rythu Bharosa (AP farmer financial assistance)
      if (s.id === "SCHEME-009") {
        if (landholder === true && ["farmer", "cultivator"].includes(occupation || "") && ["all-india", "andhra pradesh", "ap"].includes(stateNorm)) {
          matchReasons.push("Eligible farmer in Andhra Pradesh for ₹13,500/yr financial support");
        }
      }

      // 4. Ayushman Bharat PM-JAY (SECC low income or Senior Citizen 70+)
      if (s.id === "SCHEME-002") {
        if (age !== null && age >= 70) {
          matchReasons.push(`Senior citizen (Age ${age}) eligible for Universal ₹5 Lakh health cover`);
        } else if (annual_income !== null && annual_income <= 250000) {
          matchReasons.push("Household income meets SECC BPL criteria for ₹5 Lakh cashless hospital cover");
        }
      }

      // 5. Stand Up India (SC/ST or Woman Entrepreneur)
      if (s.id === "SCHEME-013") {
        if (gender === "female" || (caste && ["sc", "st"].includes(caste))) {
          matchReasons.push("Eligible as SC/ST/Woman entrepreneur for ₹10 Lakh to ₹1 Crore greenfield credit");
        }
      }

      // 6. PM Vishwakarma (Artisan trade specific)
      if (s.id === "SCHEME-011") {
        if (occupation && ["artisan", "craftsperson", "carpenter", "blacksmith", "tailor", "potter", "weaver"].includes(occupation)) {
          matchReasons.push("Traditional artisan eligible for collateral-free ₹1L-₹2L loans at 5% + ₹15,000 toolkit voucher");
        }
      }

      if (matchReasons.length > 0) {
        likelyMatches.push({
          scheme_id: s.id,
          scheme_name: s.name,
          official_url: s.official_url,
          reasons: matchReasons,
          status: missingFields.length > 0 ? "Provisional Match (Incomplete Profile)" : "Likely Eligible",
          next_step: `Confirm exact statutory documentation at ${s.official_url}`
        });
      }
    }

    return new Response(
      JSON.stringify({
        likely_eligible_schemes: likelyMatches.slice(0, 6),
        evaluation_status: missingFields.length > 0 ? "partial_profile" : "complete_profile",
        missing_fields: missingFields,
        disclaimer: "Provisional screening only based solely on citizen-submitted attributes. Formal entitlement requires document verification by the administering department."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
