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
   * Converts Devanagari (०-९) and Telugu (౦-౯) numerals to standard ASCII digits (0-9).
   */
  function convertIndicDigits(text) {
    if (!text) return "";
    const digitMap = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
      '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
      '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
    };
    return String(text).replace(/[०-९౦-౯]/g, d => digitMap[d]);
  }

  /**
   * Converts spoken number words (English, Hindi, Telugu, and Roman transliterations)
   * and Indic numerals into standard ASCII digits.
   */
  function wordsToDigits(transcript) {
    if (!transcript) return "";
    let text = convertIndicDigits(String(transcript).toLowerCase());

    const wordEntries = [
      // 0
      ['zero', '0'], ['oh', '0'], ['shunya', '0'], ['soonya', '0'], ['sunya', '0'], ['sunna', '0'],
      ['शून्य', '0'], ['సున్నా', '0'],
      // 1
      ['one', '1'], ['ek', '1'], ['aik', '1'], ['okati', '1'], ['okkati', '1'], ['okate', '1'],
      ['एक', '1'], ['ఒకటి', '1'],
      // 2
      ['two', '2'], ['do', '2'], ['doh', '2'], ['rendu', '2'],
      ['दो', '2'], ['రెండు', '2'],
      // 3
      ['three', '3'], ['teen', '3'], ['tin', '3'], ['moodu', '3'], ['mudu', '3'],
      ['तीन', '3'], ['మూడు', '3'],
      // 4
      ['four', '4'], ['chaar', '4'], ['char', '4'], ['naalugu', '4'], ['nalugu', '4'],
      ['चार', '4'], ['నాలుగు', '4'],
      // 5
      ['five', '5'], ['paanch', '5'], ['panch', '5'], ['aidu', '5'], ['ayidu', '5'],
      ['पाँच', '5'], ['पांच', '5'], ['ఐదు', '5'],
      // 6
      ['six', '6'], ['chhah', '6'], ['chhe', '6'], ['cheh', '6'], ['chha', '6'], ['aaru', '6'], ['aru', '6'],
      ['छह', '6'], ['ఆరు', '6'],
      // 7
      ['seven', '7'], ['saat', '7'], ['sat', '7'], ['eedu', '7'], ['edu', '7'],
      ['सात', '7'], ['ఏడు', '7'],
      // 8
      ['eight', '8'], ['aath', '8'], ['aat', '8'], ['enimidi', '8'], ['yanimidi', '8'],
      ['आठ', '8'], ['ఎనిమిది', '8'],
      // 9
      ['nine', '9'], ['nau', '9'], ['now', '9'], ['thommidi', '9'], ['tommidi', '9'],
      ['नौ', '9'], ['తొమ్మిది', '9'],
      // single char 'o'
      ['o', '0']
    ];

    for (const [w, d] of wordEntries) {
      const reg = new RegExp('(?<![\\p{L}\\p{N}])' + w + '(?![\\p{L}\\p{N}])', 'gui');
      text = text.replace(reg, d);
    }

    return text.replace(/\D/g, "");
  }

  /**
   * Deduplicates adjacent repeated words and repeated 2-word phrases caused
   * by streaming speech-to-text interim buffer updates.
   * Works across English, Telugu, and Hindi scripts.
   */
  function deduplicateConsecutiveWords(text) {
    if (!text || typeof text !== 'string') return '';
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return text.trim();

    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const curr = tokens[i];
      const prev = result.length > 0 ? result[result.length - 1] : null;
      // Suppress single adjacent duplicate
      if (prev && curr.toLowerCase() === prev.toLowerCase()) {
        continue;
      }
      result.push(curr);

      // Check 2-word phrase duplicate at end: [..., A, B, A, B]
      const len = result.length;
      if (len >= 4) {
        if (
          result[len - 2].toLowerCase() === result[len - 4].toLowerCase() &&
          result[len - 1].toLowerCase() === result[len - 3].toLowerCase()
        ) {
          result.splice(len - 2, 2);
        }
      }
    }
    return result.join(' ');
  }

  /**
   * Pure deterministic entity extractor for citizen speech and text input.
   * Extracts Aadhaar (12 digits), phone (10 digits starting 6-9), pincode, email, citizen name, and location.
   * Fully supports English, Hindi, and Telugu Indic scripts and terminology.
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

    // Convert Indic numerals (Devanagari ०-९ and Telugu ౦-౯) to standard ASCII 0-9
    const normalizedText = convertIndicDigits(text);

    // 1. Aadhaar / UID (12 digits, continuous or grouped with spaces/hyphens)
    // Supports Indic Aadhaar terms: Hindi (आधार, आधार संख्या, यूआईडी) and Telugu (ఆధార్, ఆధార్ సంఖ్య, యూఐడీ)
    const aadhaarMatch = normalizedText.match(/(?:aadhaar|aadhar|uid|uidai|आधार(?:\s*संख्या)?|यूआईडी|ఆధార్(?:\s*సంఖ్య)?|యూఐడీ)[\s:=]*([0-9]{4}\s?[0-9]{4}\s?[0-9]{4})\b/iu) ||
                         normalizedText.match(/\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b/) ||
                         normalizedText.match(/\b([0-9]{12})\b/);
    if (aadhaarMatch) {
      res.extractedAadhaar = aadhaarMatch[1].replace(/\s+/g, "");
    }

    // 2. Phone / Mobile (10 digits starting with 6-9)
    // Supports Indic phone terms: Hindi (फोन, मोबाइल, संपर्क) and Telugu (ఫోన్, మొబైల్, సంప్రదింపు)
    const phoneMatch = normalizedText.match(/(?:phone|mobile|contact|cell|फोन|मोबाइल|संपर्क|ఫోన్|మొబైల్|సంప్రదింపు)[\s:=]*([6-9][0-9]{9})\b/iu) ||
                       normalizedText.match(/\b([6-9][0-9]{9})\b/);
    if (phoneMatch) {
      res.extractedPhone = phoneMatch[1];
    }

    // 3. Pincode (6 digits starting with 1-9)
    const pinMatch = normalizedText.match(/(?:pin|pincode|postal|पिन|पिनकोड|పిన్|పిన్‌కోడ్)[\s:=]*([1-9][0-9]{5})\b/iu) ||
                     normalizedText.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      res.extractedPin = pinMatch[1];
    }

    // 4. Email
    const emailMatch = normalizedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      res.extractedEmail = emailMatch[1];
    }

    // 5. Citizen Name
    // Supports Indic name prefixes: Hindi (मेरा नाम, नाम) and Telugu (నా పేరు, పేరు)
    const nameMatch = normalizedText.match(/(?:my name is|i am|myself|citizen:?|मेरा\s+नाम(?:\s+है)?|नाम:?|నా\s+పేరు(?:\s+వచ్చేసి)?|పేరు:?)\s+([^.,\n|।]+?)(?=\s+(?:and|who|from|need|residing|with|my|और|है|మరియు|నాకు|నుండి)(?![\p{L}\p{N}])|[.,\n|।]|$)/iu);
    if (nameMatch) {
      res.extractedName = nameMatch[1].trim();
    }

    // 6. Location
    const locMatch = normalizedText.match(/(?:in|at|near|around|from|opposite|behind|beside|lane|colony|ward|sector|street|nagar|road|dist|district|city)\s+([A-Za-z0-9\s,\-_#]+?)(?=\s+(?:since|which|please|causing|due|and\s+it|is\s+broken|[.,\n]|$))/i);
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
    convertIndicDigits,
    wordsToDigits,
    deduplicateConsecutiveWords,
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
