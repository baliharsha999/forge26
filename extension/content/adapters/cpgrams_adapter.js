/**
 * CPGRAMS Portal Adapter for JanSetu Lite
 * Supports https://pgportal.gov.in/* (Fill-only, NEVER auto-submits)
 */
class CPGRAMSAdapter extends BasePortalAdapter {
  constructor() {
    super("Central Public Grievance Portal (CPGRAMS)", ["pgportal.gov.in"]);
  }

  async fill(formData, onProgress) {
    const report = (msg) => {
      if (typeof onProgress === "function") onProgress(msg);
    };

    report("Scanning CPGRAMS portal structure...");

    // CPGRAMS grievance description textarea
    const textareas = document.querySelectorAll("textarea");
    if (textareas.length > 0) {
      this.setValueWithEvents(textareas[0], formData.description);
      report("Filled CPGRAMS Grievance Description");
    } else {
      return {
        success: false,
        error: "LAYOUT_CHANGED",
        missingSelectors: ["textarea"]
      };
    }

    return {
      success: true,
      readyToSubmit: false, // On real portal, citizen must review, enter OTP/CAPTCHA and click submit!
      notice: "JanSetu Lite has filled your petition. Please verify, complete CAPTCHA, and click Submit."
    };
  }

  async readTrackingId() {
    // Look for registration confirmation text
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(?:Registration No|Regn No|Grievance No)[:\s]+([A-Z0-9\/_-]+)/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }
}

window.CPGRAMSAdapter = CPGRAMSAdapter;
