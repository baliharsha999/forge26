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
    const {
      occupation = "farmer",
      annual_income = 180000,
      gender = "any",
      age = 32,
      landholder = true,
      state = "All-India",
      has_school_children = false,
      caste = "general"
    } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: allSchemes } = await supabase
      .from("schemes")
      .select("*");

    const stateNorm = state.toLowerCase();
    const casteNorm = caste.toLowerCase();
    const likelyMatches: any[] = [];

    for (const s of (allSchemes || [])) {
      const matchReasons: string[] = [];
      const sState = (s.state || "All-India").toLowerCase();

      if (sState !== "all-india" && stateNorm !== "all-india" && sState !== stateNorm) {
        continue;
      }

      // 1. Thalliki Vandanam
      if (s.id === "SCHEME-016" && has_school_children) {
        if (["all-india", "andhra pradesh", "ap"].includes(stateNorm)) {
          matchReasons.push("Eligible for ₹15,000/yr DBT per school-going child in Andhra Pradesh");
        }
      }

      // 2. PM-KISAN
      if (s.id === "SCHEME-001" && landholder && occupation === "farmer") {
        matchReasons.push("Eligible landholder farmer for ₹6,000/yr DBT in 3 installments");
      }

      // 3. YSR Rythu Bharosa
      if (s.id === "SCHEME-009" && landholder && ["all-india", "andhra pradesh", "ap"].includes(stateNorm)) {
        matchReasons.push("Eligible farmer in Andhra Pradesh for ₹13,500/yr financial support");
      }

      // 4. Ayushman Bharat PM-JAY
      if (s.id === "SCHEME-002") {
        if (age >= 70) {
          matchReasons.push(`Senior citizen (Age ${age}) eligible for Universal ₹5 Lakh health cover`);
        } else if (annual_income <= 250000) {
          matchReasons.push("Household income meets SECC BPL criteria for ₹5 Lakh cashless health cover");
        }
      }

      // 5. Stand Up India
      if (s.id === "SCHEME-013" && (gender === "female" || ["sc", "st"].includes(casteNorm))) {
        matchReasons.push("Eligible as SC/ST/Woman entrepreneur for ₹10 Lakh to ₹1 Crore greenfield credit");
      }

      // 6. PM Vishwakarma
      if (s.id === "SCHEME-011" && ["artisan", "craftsperson", "carpenter", "blacksmith", "tailor"].includes(occupation)) {
        matchReasons.push("Traditional artisan eligible for collateral-free ₹1L-₹2L loans at 5% + ₹15k toolkit voucher");
      }

      if (matchReasons.length > 0) {
        likelyMatches.push({
          scheme_id: s.id,
          scheme_name: s.name,
          official_url: s.official_url,
          reasons: matchReasons,
          status: "Likely Eligible",
          next_step: `Confirm exact documentation at ${s.official_url}`
        });
      }
    }

    return new Response(
      JSON.stringify({
        likely_eligible_schemes: likelyMatches.slice(0, 6),
        disclaimer: "Non-definitive evaluation based on citizen-provided details. Always verify at official portal."
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
