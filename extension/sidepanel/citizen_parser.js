/**
 * Nagarik AI - Production Citizen Parser & Civic Entity Heuristics
 * Shared module for side panel UI and automated test suite.
 */
(function(root) {
  // Civic Concept Synonym Graph for Department Inference
  const CIVIC_CONCEPT_SYNONYMS = {
    "Water Supply & Sewerage Board": [
      "water", "sewerage", "drainage", "pipe", "pipeline", "tap", "leakage", "drain", "sewage", "jal", "neellu", "paani", "manhole", "water supply"
    ],
    "State Electricity Distribution Company (DISCOM)": [
      "electricity", "power", "discom", "current", "voltage", "transformer", "wire", "pole", "meter", "bijli", "vidyut", "blackout", "power cut", "eb", "bescom", "tsspdcl", "tneb", "mseb", "light"
    ],
    "Municipal Corporation & Public Works": [
      "road", "pothole", "pavement", "street", "footpath", "bridge", "public works", "pwd", "highway", "traffic", "building", "encroachment", "tree"
    ],
    "Solid Waste Management & Public Health": [
      "waste", "garbage", "solid waste", "sanitation", "cleanliness", "trash", "kuda", "debris", "mosquitoes", "fogging", "sweeping", "dump", "bin"
    ],
    "Civil Supplies & Consumer Affairs": [
      "ration", "civil supplies", "consumer", "pds", "fair price", "food grain", "subsidy", "dealer", "ration card"
    ]
  };

  /**
   * Pure deterministic entity extractor for citizen speech and text input.
   * Extracts Aadhaar (12 digits), phone (10 digits starting 6-9), pincode, email, citizen name, and location.
   */
  function parseCitizenInput(text) {
    const res = {
      rawText: text || "",
      extractedAadhaar: null,
      extractedPhone: null,
      extractedPin: null,
      extractedEmail: null,
      extractedName: null,
      extractedLocation: null
    };
    if (!text) return res;

    // 1. Aadhaar / UID (12 digits, continuous or grouped with spaces/hyphens)
    const aadhaarMatch = text.match(/(?:aadhaar|aadhar|uid|uidai)[\s:=]*([0-9]{4}\s?[0-9]{4}\s?[0-9]{4})\b/i) ||
                         text.match(/\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b/) ||
                         text.match(/\b([0-9]{12})\b/);
    if (aadhaarMatch) {
      res.extractedAadhaar = aadhaarMatch[1].replace(/\s+/g, "");
    }

    // 2. Phone / Mobile (10 digits starting with 6-9)
    const phoneMatch = text.match(/(?:phone|mobile|contact|cell)[\s:=]*([6-9][0-9]{9})\b/i) ||
                       text.match(/\b([6-9][0-9]{9})\b/);
    if (phoneMatch) {
      res.extractedPhone = phoneMatch[1];
    }

    // 3. Pincode (6 digits starting with 1-9)
    const pinMatch = text.match(/(?:pin|pincode|postal)[\s:=]*([1-9][0-9]{5})\b/i) ||
                     text.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      res.extractedPin = pinMatch[1];
    }

    // 4. Email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      res.extractedEmail = emailMatch[1];
    }

    // 5. Citizen Name
    const nameMatch = text.match(/(?:my name is|i am|myself|citizen:?)\s+([^.,\n]+?)(?=\s+(?:and|who|from|need|residing|with|my)\b|[.,\n]|$)/i);
    if (nameMatch) {
      res.extractedName = nameMatch[1].trim();
    }

    // 6. Location
    const locMatch = text.match(/(?:in|at|near|around|from|opposite|behind|beside|lane|colony|ward|sector|street|nagar|road|dist|district|city)\s+([A-Za-z0-9\s,\-_#]+?)(?=\s+(?:since|which|please|causing|due|and\s+it|is\s+broken|[.,\n]|$))/i);
    if (locMatch) {
      res.extractedLocation = locMatch[0].trim();
    }

    return res;
  }

  function inferCivicDepartment(text) {
    if (!text) return "Municipal Corporation & Public Works";
    const t = text.toLowerCase();
    let bestDept = "Municipal Corporation & Public Works";
    let maxMatches = 0;
    for (const [dept, keywords] of Object.entries(CIVIC_CONCEPT_SYNONYMS)) {
      let score = 0;
      for (const kw of keywords) {
        if (t.includes(kw)) score += kw.length;
      }
      if (score > maxMatches) {
        maxMatches = score;
        bestDept = dept;
      }
    }
    return bestDept;
  }

  function inferCategory(text, dept) {
    const t = text.toLowerCase();
    if (dept.includes("Water") || t.includes("water") || t.includes("leak") || t.includes("pipe") || t.includes("drainage")) {
      return "Water Pipeline Leakage & Sewerage Disruption";
    }
    if (dept.includes("Electricity") || t.includes("power") || t.includes("electricity") || t.includes("voltage") || t.includes("current")) {
      return "Frequent Power Outage / Voltage Fluctuation";
    }
    if (t.includes("pothole") || t.includes("road") || t.includes("street")) {
      return "Dangerous Road Potholes & Infrastructure Damage";
    }
    if (t.includes("garbage") || t.includes("waste") || t.includes("trash")) {
      return "Solid Waste Accumulation & Sanitation Hazard";
    }
    if (t.includes("ration") || t.includes("pds") || t.includes("dealer")) {
      return "Public Distribution System & Fair Price Denial";
    }
    return "Public Infrastructure & Civic Amenity Grievance";
  }

  function inferUrgency(text) {
    const t = text.toLowerCase();
    if (/immediate|urgent|hazard|severe|danger|health|safety|overflow|emergency|shock|fire|leak|dengue|hospital|blocked|night/i.test(t)) {
      return "HIGH";
    }
    return "MEDIUM";
  }

  function generateFormalPetition(problemText, name, phone, location, category) {
    return `SUBJECT: Urgent Redressal Request Regarding ${category}

RESPECTED OFFICER,

I am bringing to your urgent attention the following civic grievance:
"${problemText}"

INCIDENT LOCATION / JURISDICTION:
${location}

This condition causes severe inconvenience and potential health/safety risks for local residents.

REQUESTED REMEDY:
1. Urgent on-site inspection by the designated municipal or departmental officer.
2. Immediate repair, rectification, or clearance of the issue.
3. Official confirmation and dispatch reference.

Submitted in good faith by ${name}, Contact: ${phone}.`.trim();
  }

  const exp = {
    CIVIC_CONCEPT_SYNONYMS,
    parseCitizenInput,
    inferCivicDepartment,
    inferCategory,
    inferUrgency,
    generateFormalPetition
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exp;
  }
  if (typeof window !== "undefined") {
    Object.assign(window, exp);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
