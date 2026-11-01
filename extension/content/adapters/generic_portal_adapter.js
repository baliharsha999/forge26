/**
 * Nagarik AI - Universal Civic Portal Adapter
 * Universal adapter utilizing semantic heuristics to inspect and fill any
 * municipal, state, central public service portal, or any website on desktop.
 */
function querySelectorAllDeep(selector, root = document) {
  let results = [];
  try {
    results = Array.from(root.querySelectorAll(selector));
  } catch (e) {}
  try {
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      if (currentNode.shadowRoot) {
        results = results.concat(querySelectorAllDeep(selector, currentNode.shadowRoot));
      }
      currentNode = treeWalker.nextNode();
    }
  } catch (e) {}
  return results;
}

class GenericCivicAdapter extends BasePortalAdapter {
  constructor() {
    super("Universal Web Portal", [".*"]);
  }

  /**
   * Universally supported on EVERY website and URL
   */
  isSupported(url) {
    return true;
  }

  /**
   * Helper to find an input element by fuzzy label/attribute match (supports Shadow DOM)
   */
  findElementByKeywords(keywords, tagTypes = ["input", "textarea", "select"]) {
    // 1. Search by label text association
    const labels = querySelectorAllDeep("label");
    for (const label of labels) {
      const text = (label.innerText || "").toLowerCase();
      if (keywords.some(k => text.includes(k))) {
        if (label.htmlFor) {
          const target = document.getElementById(label.htmlFor);
          if (target) return target;
        }
        for (const t of tagTypes) {
          const nested = label.querySelector(t);
          if (nested) return nested;
        }
      }
    }

    // 2. Search by input attributes (id, name, placeholder, aria-label, title) across regular and shadow DOM
    for (const tag of tagTypes) {
      const elements = querySelectorAllDeep(tag);
      for (const el of elements) {
        if (el.type === "hidden" || el.style.display === "none") continue;
        const attrStr = `${el.id} ${el.name} ${el.placeholder || ""} ${el.getAttribute("aria-label") || ""} ${el.title || ""}`.toLowerCase();
        if (keywords.some(k => attrStr.includes(k))) {
          return el;
        }
      }
    }

    return null;
  }

  async inspect() {
    const fields = [];

    // Aadhaar / UID / Identity
    const uidEl = this.findElementByKeywords(["uid", "aadhaar", "aadhar", "adharnumber", "aadhaarno", "aadharno", "uidai", "id_number", "identity_no"], ["input"]);
    if (uidEl) {
      fields.push({
        key: 'uid',
        label: 'Aadhaar / UID Number',
        selector: uidEl.id ? `#${uidEl.id}` : 'input[name*="uid" i]',
        required: true,
        exists: true,
        value: (uidEl.value || '').trim(),
        isFilled: (uidEl.value || '').trim().length > 0
      });
    }

    // Captcha Code
    const captchaEl = this.findElementByKeywords(["captcha", "security code", "security_code", "captchacode"], ["input"]);
    if (captchaEl) {
      fields.push({
        key: 'captcha',
        label: 'Security Captcha Code',
        selector: captchaEl.id ? `#${captchaEl.id}` : 'input[name*="captcha" i]',
        required: true,
        exists: true,
        value: (captchaEl.value || '').trim(),
        isFilled: (captchaEl.value || '').trim().length > 0
      });
    }

    // OTP Code
    const otpEl = this.findElementByKeywords(["otp", "one time password", "passcode", "security token", "verification_code"], ["input"]);
    if (otpEl) {
      fields.push({
        key: 'otp',
        label: 'One-Time Password (OTP)',
        selector: otpEl.id ? `#${otpEl.id}` : 'input[name*="otp" i]',
        required: true,
        exists: true,
        value: (otpEl.value || '').trim(),
        isFilled: (otpEl.value || '').trim().length > 0
      });
    }

    // Description / Grievance / Problem
    const descEl = this.findElementByKeywords(["grievance", "complaint", "description", "details", "problem", "issue", "petition", "remarks", "message", "comments", "query"], ["textarea", "input"]);
    if (descEl) {
      fields.push({
        key: 'description',
        label: 'Grievance / Problem Description',
        selector: descEl.id ? `#${descEl.id}` : 'textarea',
        required: true,
        exists: true,
        value: (descEl.value || '').trim(),
        isFilled: (descEl.value || '').trim().length > 0
      });
    }

    // Citizen Name
    const nameEl = this.findElementByKeywords(["name", "citizen", "applicant", "fullname", "candidate", "user", "first_name", "fname"], ["input"]);
    if (nameEl) {
      fields.push({
        key: 'citizen_name',
        label: 'Citizen Full Name',
        selector: nameEl.id ? `#${nameEl.id}` : 'input[name*="name" i]',
        required: true,
        exists: true,
        value: (nameEl.value || '').trim(),
        isFilled: (nameEl.value || '').trim().length > 0
      });
    }

    // Mobile / Contact
    const phoneEl = this.findElementByKeywords(["mobile", "phone", "contact", "cell", "tel"], ["input"]);
    if (phoneEl) {
      fields.push({
        key: 'citizen_phone',
        label: 'Contact Mobile Number',
        selector: phoneEl.id ? `#${phoneEl.id}` : 'input[type="tel"]',
        required: true,
        exists: true,
        value: (phoneEl.value || '').trim(),
        isFilled: (phoneEl.value || '').trim().length > 0
      });
    }

    // Email
    const emailEl = this.findElementByKeywords(["email", "mail", "e-mail"], ["input"]);
    if (emailEl) {
      fields.push({
        key: 'citizen_email',
        label: 'Email Address',
        selector: emailEl.id ? `#${emailEl.id}` : 'input[type="email"]',
        required: false,
        exists: true,
        value: (emailEl.value || '').trim(),
        isFilled: (emailEl.value || '').trim().length > 0
      });
    }

    // Location / Address
    const locEl = this.findElementByKeywords(["location", "address", "ward", "landmark", "street", "city", "village", "district", "state", "locality"], ["input", "textarea"]);
    if (locEl) {
      fields.push({
        key: 'location',
        label: 'Location / Address',
        selector: locEl.id ? `#${locEl.id}` : 'input',
        required: true,
        exists: true,
        value: (locEl.value || '').trim(),
        isFilled: (locEl.value || '').trim().length > 0
      });
    }

    // Pincode / Postal
    const pinEl = this.findElementByKeywords(["pincode", "pin_code", "pin", "postal_code", "zip"], ["input"]);
    if (pinEl) {
      fields.push({
        key: 'pincode',
        label: 'Postal Pincode',
        selector: pinEl.id ? `#${pinEl.id}` : 'input',
        required: false,
        exists: true,
        value: (pinEl.value || '').trim(),
        isFilled: (pinEl.value || '').trim().length > 0
      });
    }

    // Category / Department
    const catEl = this.findElementByKeywords(["category", "department", "ministry", "service", "topic", "subject"], ["select", "input"]);
    if (catEl) {
      fields.push({
        key: 'category',
        label: 'Category / Department',
        selector: catEl.id ? `#${catEl.id}` : 'select',
        required: false,
        exists: true,
        value: (catEl.value || '').trim(),
        isFilled: (catEl.value || '').trim().length > 0
      });
    }

    // Photo / Attachment
    const fileEl = document.querySelector("input[type='file']");
    if (fileEl) {
      fields.push({
        key: 'photo',
        label: 'Evidence Document / Photo',
        selector: 'input[type="file"]',
        required: false,
        exists: true,
        value: fileEl.value ? 'File attached' : '',
        isFilled: !!fileEl.value
      });
    }

    // Fallback: If no recognized fields were found above, find any inputs on the page
    if (fields.length === 0) {
      const genericInputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"));
      genericInputs.slice(0, 10).forEach((el, i) => {
        const key = el.name || el.id || `field_${i+1}`;
        fields.push({
          key: key,
          label: el.placeholder || el.name || el.id || `Input Field ${i+1}`,
          selector: el.id ? `#${el.id}` : (el.name ? `[name='${el.name}']` : el.tagName.toLowerCase()),
          required: el.required || false,
          exists: true,
          value: (el.value || '').trim(),
          isFilled: (el.value || '').trim().length > 0
        });
      });
    }

    const totalRequired = fields.filter(f => f.required).length;
    const filledRequired = fields.filter(f => f.required && f.isFilled).length;
    const hasForm = fields.length > 0;

    return {
      portalName: document.title || this.name,
      fields: fields,
      totalRequired: totalRequired,
      filledRequired: filledRequired,
      hasForm: hasForm,
      pageState: hasForm ? "FORM_ACTIVE" : "INFO_PAGE",
      isFullyFilled: hasForm && totalRequired > 0 && totalRequired === filledRequired
    };
  }

  async fillSingleField(key, value) {
    if (!value && key !== 'photo') return { success: false, error: 'Empty value' };

    let el = null;
    if (key === 'uid' || key === 'aadhaar' || key === 'aadhar' || key === 'id_number') {
      el = this.findElementByKeywords(["uid", "aadhaar", "aadhar", "adharnumber", "aadhaarno", "aadharno", "uidai", "id_number", "identity_no"], ["input"]);
    } else if (key === 'otp' || key === 'one_time_password' || key === 'passcode') {
      el = this.findElementByKeywords(["otp", "one time password", "passcode", "security token", "verification_code"], ["input"]);
    } else if (key === 'description' || key === 'grievance' || key === 'problem') {
      el = this.findElementByKeywords(["grievance", "complaint", "description", "details", "problem", "issue", "petition", "remarks", "message"], ["textarea", "input"]);
    } else if (key === 'citizen_name' || key === 'name' || key === 'fullname') {
      el = this.findElementByKeywords(["name", "citizen", "applicant", "fullname", "candidate"], ["input"]);
    } else if (key === 'citizen_phone' || key === 'phone' || key === 'mobile') {
      el = this.findElementByKeywords(["mobile", "phone", "contact", "cell", "tel"], ["input"]);
    } else if (key === 'citizen_email' || key === 'email') {
      el = this.findElementByKeywords(["email", "mail", "e-mail"], ["input"]);
    } else if (key === 'pincode' || key === 'pin_code' || key === 'zip') {
      el = this.findElementByKeywords(["pincode", "pin_code", "postal_code", "zip", "pin"], ["input"]);
    } else if (key === 'location' || key === 'address') {
      el = this.findElementByKeywords(["location", "address", "ward", "landmark", "street", "city", "village", "district"], ["input", "textarea"]);
      if (!el) {
        // Fallback: append to description textarea if no dedicated location input
        const descEl = this.findElementByKeywords(["grievance", "complaint", "description"], ["textarea"]);
        if (descEl) {
          const current = descEl.value || '';
          const updated = current.includes(value) ? current : `${current}\n\n[Location / Landmark: ${value}]`.trim();
          this.setValueWithEvents(descEl, updated);
          return { success: true, key };
        }
      }
    } else if (key === 'category' || key === 'department') {
      el = this.findElementByKeywords(["category", "department", "ministry", "service"], ["select", "input"]);
      if (el && el.tagName === "SELECT") {
        const valStr = String(value).toLowerCase();
        const option = Array.from(el.options).find(o => o.text.toLowerCase().includes(valStr) || o.value.toLowerCase().includes(valStr));
        if (option) {
          el.value = option.value;
          el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          el.classList.add("jansetu-highlight");
          return { success: true, key };
        }
      }
    } else if (key === 'photo') {
      const fileInput = document.querySelector("input[type='file']");
      if (fileInput && value) {
        this.setFileInputWithDataTransfer(fileInput, value, 'evidence.png');
        return { success: true, key };
      }
    }

    if (el) {
      this.setValueWithEvents(el, value);
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      return { success: true, key };
    }

    return { success: false, error: `Could not locate field for ${key}` };
  }

  async fill(formData, onProgress) {
    const report = (msg) => {
      if (typeof onProgress === "function") onProgress(msg);
    };

    report("Scanning page form fields...");
    let filledCount = 0;

    if (formData.uid || formData.aadhaar || formData.aadhar || formData.id_number) {
      const uidVal = formData.uid || formData.aadhaar || formData.aadhar || formData.id_number;
      const uidEl = this.findElementByKeywords(["uid", "aadhaar", "aadhar", "adharnumber", "aadhaarno", "aadharno", "uidai", "id_number", "identity_no"], ["input"]);
      if (uidEl) {
        this.setValueWithEvents(uidEl, uidVal);
        filledCount++;
        report("Filled Aadhaar / UID number");
      }
    }

    if (formData.description || formData.problem_raw) {
      const descEl = this.findElementByKeywords(["grievance", "complaint", "description", "problem", "details"], ["textarea", "input"]);
      if (descEl) {
        this.setValueWithEvents(descEl, formData.description || formData.problem_raw);
        filledCount++;
        report("Filled description");
      }
    }

    if (formData.citizen_name || formData.name) {
      const nameEl = this.findElementByKeywords(["name", "citizen", "applicant", "fullname"], ["input"]);
      if (nameEl) {
        this.setValueWithEvents(nameEl, formData.citizen_name || formData.name);
        filledCount++;
        report("Filled citizen name");
      }
    }

    if (formData.citizen_phone || formData.phone) {
      const phoneEl = this.findElementByKeywords(["mobile", "phone", "contact"], ["input"]);
      if (phoneEl) {
        this.setValueWithEvents(phoneEl, formData.citizen_phone || formData.phone);
        filledCount++;
        report("Filled contact number");
      }
    }

    if (formData.citizen_email || formData.email) {
      const emailEl = this.findElementByKeywords(["email", "mail"], ["input"]);
      if (emailEl) {
        this.setValueWithEvents(emailEl, formData.citizen_email || formData.email);
        filledCount++;
        report("Filled email");
      }
    }

    if (formData.location || formData.address) {
      const locEl = this.findElementByKeywords(["location", "address", "ward", "landmark", "city"], ["input", "textarea"]);
      if (locEl) {
        this.setValueWithEvents(locEl, formData.location || formData.address);
        filledCount++;
        report("Filled location");
      }
    }

    if (formData.pincode || formData.pin_code) {
      const pinEl = this.findElementByKeywords(["pincode", "pin_code", "zip", "pin"], ["input"]);
      if (pinEl) {
        this.setValueWithEvents(pinEl, formData.pincode || formData.pin_code);
        filledCount++;
        report("Filled pincode");
      }
    }

    return {
      success: filledCount > 0,
      filledCount,
      readyToSubmit: false,
      notice: `Nagarik AI populated ${filledCount} fields with privacy shielding.`
    };
  }

  async readTrackingId() {
    const bodyText = document.body ? document.body.innerText : "";
    const match = bodyText.match(/(?:Registration No|Regn No|Grievance No|Complaint No|Token No|Ref No|Application No|Ack No)[:\s]+([A-Z0-9\/_-]+)/i);
    return match ? match[1].trim() : null;
  }
}

window.GenericCivicAdapter = GenericCivicAdapter;
