(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var pwaConfig = window.HugoPicoPWA || {};
  var installHintEnabled = pwaConfig.installHintEnabled !== false;
  var installHintStorageKey = pwaConfig.installHintStorageKey || 'hugo-pico-ios-install-hint-dismissed';

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

  function isIOSBrowser() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    var maxTouchPoints = navigator.maxTouchPoints || 0;
    return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function installHintDismissed() {
    try {
      return localStorage.getItem(installHintStorageKey) === '1';
    } catch (e) {
      return false;
    }
  }

  function dismissInstallHint() {
    try {
      localStorage.setItem(installHintStorageKey, '1');
    } catch (e) {}

    var hint = document.querySelector('.pwa-install-hint');
    if (hint) hint.remove();
  }

  function showInstallHint() {
    if (!installHintEnabled || !isIOSBrowser() || isStandalone() || installHintDismissed()) return;

    var hint = document.createElement('aside');
    hint.className = 'pwa-install-hint';
    hint.setAttribute('role', 'dialog');
    hint.setAttribute('aria-label', 'Install app hint');
    hint.innerHTML =
      '<button type="button" class="pwa-install-hint-close" aria-label="Dismiss install hint" title="Dismiss">&times;</button>' +
      '<div class="pwa-install-hint-copy">' +
        '<strong>Add AI VOID to Home Screen</strong>' +
        '<span>On iPhone or iPad, use Share, then Add to Home Screen.</span>' +
      '</div>';

    hint.querySelector('.pwa-install-hint-close').addEventListener('click', dismissInstallHint);
    document.body.appendChild(hint);
  }

  window.addEventListener('load', function () {
    window.setTimeout(showInstallHint, 1600);
  });
})();
