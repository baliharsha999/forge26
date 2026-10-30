/**
 * Adapter Registry for JanSetu Lite
 */
const adapters = [
  new window.MockPortalAdapter(),
  new window.CPGRAMSAdapter()
];

window.getPortalAdapter = function(url) {
  const targetUrl = url || window.location.href;
  for (const adapter of adapters) {
    if (adapter.isSupported(targetUrl)) {
      return adapter;
    }
  }
  return null;
};
