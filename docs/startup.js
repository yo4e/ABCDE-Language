/* Independent startup fallback: input stays disabled until app.js finishes. */
(() => {
  'use strict';
  document.getElementById('reload').addEventListener('click', () => location.reload());
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('controls').disabled) return;
    document.getElementById('controls').setAttribute('aria-busy', 'false');
    document.getElementById('loading').hidden = true;
    document.getElementById('load-error').hidden = false;
  });
})();
