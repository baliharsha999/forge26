/**
 * Nagarik AI - Adapter Registry
 * Ensures every website on a citizen's desktop has an active adapter.
 */
const adapters = [
  new window.MockPortalAdapter(),
  new window.CPGRAMSAdapter(),
  new window.GenericCivicAdapter()
];

window.getPortalAdapter = function(url) {
  const targetUrl = url || window.location.href;
  for (const adapter of adapters) {
    if (adapter && typeof adapter.isSupported === "function" && adapter.isSupported(targetUrl)) {
      return adapter;
    }
  }
  // ALWAYS return GenericCivicAdapter so every single website is supported
  return adapters[2] || new window.GenericCivicAdapter();
};
