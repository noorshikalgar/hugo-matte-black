(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var script = document.currentScript;
  var swUrl = '/sw.js';
  if (script && script.src) {
    swUrl = script.src.replace(/\/js\/pwa\.js(?:\?.*)?$/, '/sw.js');
  }

  function registerServiceWorker() {
    navigator.serviceWorker.register(swUrl).catch(function () {});
  }

  window.addEventListener('load', function () {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(registerServiceWorker, { timeout: 4000 });
      return;
    }

    window.setTimeout(registerServiceWorker, 2000);
  });
})();
