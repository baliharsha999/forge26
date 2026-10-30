/**
 * Nagarik AI - Adapter Registry
 */
const adapters = [
  new window.MockPortalAdapter(),
  new window.CPGRAMSAdapter(),
  new window.GenericCivicAdapter()
];

window.getPortalAdapter = function(url) {
  const targetUrl = url || window.location.href;
  for (const adapter of adapters) {
    if (adapter.isSupported(targetUrl)) {
      return adapter;
    }
  }
  // Fallback to GenericCivicAdapter if any forms exist on page
  if (document.querySelector("form, textarea, input")) {
    return adapters[2];
  }
  return null;
};
