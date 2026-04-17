(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var script = document.currentScript;
  var swUrl = '/sw.js';
  if (script && script.src) {
    swUrl = script.src.replace(/\/js\/pwa\.js(?:\?.*)?$/, '/sw.js');
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).catch(function () {});
  });
})();
