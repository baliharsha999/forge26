/**
 * JanSetu Lite - Base Portal Adapter
 * Defines the contract for all municipal and public service portals.
 */
class BasePortalAdapter {
  constructor(name, domainPatterns) {
    this.name = name;
    this.domainPatterns = domainPatterns;
  }

  isSupported(url) {
    return this.domainPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Helper to set input value and dispatch standard DOM events
   * so React, Angular, and Vue portals register the change.
   */
  setValueWithEvents(element, value) {
    if (!element) return false;
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.classList.add("jansetu-highlight");
    return true;
  }

  /**
   * Helper to attach image file using DataTransfer API
   */
  setFileInputWithDataTransfer(inputElement, base64Data, fileName = "evidence.png") {
    if (!inputElement || !base64Data) return false;
    try {
      // Decode base64 if prefixed
      const parts = base64Data.split(";base64,");
      const contentType = parts.length > 1 ? parts[0].replace("data:", "") : "image/png";
      const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
      
      const byteCharacters = atob(rawBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      const file = new File([blob], fileName, { type: contentType });

      const dt = new DataTransfer();
      dt.items.add(file);
      inputElement.files = dt.files;
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      inputElement.classList.add("jansetu-highlight");
      return true;
    } catch (e) {
      console.warn("JanSetu: DataTransfer file attachment note:", e);
      return false;
    }
  }

  async fill(formData, onProgress) {
    throw new Error("Method fill() must be implemented by concrete PortalAdapter");
  }

  async readTrackingId() {
    throw new Error("Method readTrackingId() must be implemented by concrete PortalAdapter");
  }
}

// Make globally accessible in content script scope
window.BasePortalAdapter = BasePortalAdapter;
