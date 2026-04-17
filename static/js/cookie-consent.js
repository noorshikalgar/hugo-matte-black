(function () {
  'use strict';

  var config = window.HugoPicoConsent || {};
  var STORAGE_KEY = config.storageKey || 'hugo-pico-cookie-consent';
  var VERSION = config.version || 1;
  var DEFAULT_PREFS = {
    version: VERSION,
    necessary: true,
    analytics: false,
    advertising: false,
    decided: false,
    updatedAt: null
  };
  var listeners = [];
  var analyticsLoaded = false;
  var adsLoaded = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readPrefs() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored || stored.version !== VERSION) return clone(DEFAULT_PREFS);
      return Object.assign(clone(DEFAULT_PREFS), stored, { necessary: true });
    } catch (e) {
      return clone(DEFAULT_PREFS);
    }
  }

  function writePrefs(next) {
    var prefs = Object.assign(clone(DEFAULT_PREFS), next, {
      necessary: true,
      version: VERSION,
      decided: true,
      updatedAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    applyPrefs(prefs);
    emit(prefs);
    return prefs;
  }

  function emit(prefs) {
    var detail = { preferences: clone(prefs) };
    listeners.forEach(function (fn) { fn(detail.preferences); });
    window.dispatchEvent(new CustomEvent('cookie-consent:change', { detail: detail }));
  }

  function removeCookie(name) {
    var hostParts = window.location.hostname.split('.');
    var domains = [window.location.hostname];
    if (hostParts.length > 1) {
      domains.push('.' + hostParts.slice(-2).join('.'));
    }

    domains.forEach(function (domain) {
      document.cookie = name + '=; Max-Age=0; path=/; domain=' + domain + '; SameSite=Lax';
    });
    document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
  }

  function clearTrackingCookies() {
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (/^(_ga|_gid|_gat|_gcl|_fbp|_fbc)/.test(name)) removeCookie(name);
    });
  }

  function setGoogleConsent(prefs) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
    window.gtag('consent', 'update', {
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
      ad_storage: prefs.advertising ? 'granted' : 'denied',
      ad_user_data: prefs.advertising ? 'granted' : 'denied',
      ad_personalization: prefs.advertising ? 'granted' : 'denied'
    });
  }

  function loadScript(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    Object.keys(attrs || {}).forEach(function (key) {
      script.setAttribute(key, attrs[key]);
    });
    document.head.appendChild(script);
  }

  function loadAnalytics(prefs) {
    var id = config.googleAnalyticsId;
    if (!id) return;
    window['ga-disable-' + id] = !prefs.analytics;
    if (!prefs.analytics) {
      clearTrackingCookies();
      return;
    }
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    setGoogleConsent(prefs);
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  }

  function refreshAdSlots() {
    document.querySelectorAll('.post-ad-unit').forEach(function (unit) {
      unit.classList.toggle('ads-consented', adsLoaded);
      unit.classList.toggle('ads-blocked', !adsLoaded);
    });
    if (!adsLoaded) return;
    document.querySelectorAll('ins.adsbygoogle:not([data-ad-consent-loaded])').forEach(function (slot) {
      slot.setAttribute('data-ad-consent-loaded', 'true');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    });
  }

  function loadAdvertising(prefs) {
    var client = config.googleAdsClient;
    if (!client) {
      refreshAdSlots();
      return;
    }
    if (!prefs.advertising) {
      adsLoaded = false;
      refreshAdSlots();
      return;
    }
    if (!adsLoaded) {
      adsLoaded = true;
      setGoogleConsent(prefs);
      loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client), {
        crossorigin: 'anonymous'
      });
      window.setTimeout(refreshAdSlots, 1000);
    }
    refreshAdSlots();
  }

  function activateDeferredScripts(prefs) {
    document.querySelectorAll('script[type="text/plain"][data-consent-category]').forEach(function (script) {
      var category = script.getAttribute('data-consent-category');
      if (!prefs[category] || script.getAttribute('data-consent-loaded') === 'true') return;
      var next = document.createElement('script');
      Array.prototype.slice.call(script.attributes).forEach(function (attr) {
        if (attr.name !== 'type' && attr.name !== 'data-consent-category') {
          next.setAttribute(attr.name, attr.value);
        }
      });
      next.text = script.text || script.textContent || '';
      script.setAttribute('data-consent-loaded', 'true');
      script.parentNode.insertBefore(next, script.nextSibling);
    });
  }

  function applyPrefs(prefs) {
    setGoogleConsent(prefs);
    loadAnalytics(prefs);
    loadAdvertising(prefs);
    activateDeferredScripts(prefs);
  }

  function buildUI() {
    if (document.getElementById('cookie-consent-root')) return;
    var root = document.createElement('div');
    root.id = 'cookie-consent-root';
    root.innerHTML =
      '<section class="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">' +
        '<div class="cookie-copy">' +
          '<p class="cookie-eyebrow">Privacy choice</p>' +
          '<h2>Choose what this site may load</h2>' +
          '<p>Necessary storage keeps your theme and consent choice. Analytics and ads stay off unless you allow them.</p>' +
        '</div>' +
        '<div class="cookie-actions">' +
          '<button class="secondary outline" data-cookie-action="decline">Decline</button>' +
          '<button class="secondary" data-cookie-action="customize">Customize</button>' +
          '<button data-cookie-action="accept">Accept all</button>' +
        '</div>' +
      '</section>' +
      '<dialog class="cookie-modal" id="cookie-preferences-modal" aria-labelledby="cookie-preferences-title">' +
        '<article>' +
          '<header>' +
            '<button aria-label="Close" rel="prev" data-cookie-action="close"></button>' +
            '<p class="cookie-eyebrow">Cookie settings</p>' +
            '<h2 id="cookie-preferences-title">Privacy preferences</h2>' +
          '</header>' +
          '<div class="cookie-option">' +
            '<div><strong>Necessary</strong><p>Required for saved theme, consent choice, and basic site behavior.</p></div>' +
            '<input type="checkbox" checked disabled aria-label="Necessary cookies">' +
          '</div>' +
          '<label class="cookie-option">' +
            '<div><strong>Analytics</strong><p>Helps understand page visits. Google Analytics loads only after this is enabled.</p></div>' +
            '<input type="checkbox" id="cookie-analytics" role="switch">' +
          '</label>' +
          '<label class="cookie-option">' +
            '<div><strong>Advertising</strong><p>Allows ad scripts and ad slots. Keep this off to prevent ad tracking.</p></div>' +
            '<input type="checkbox" id="cookie-advertising" role="switch">' +
          '</label>' +
          '<footer class="cookie-modal-actions">' +
            '<button class="secondary outline" data-cookie-action="decline">Decline all</button>' +
            '<button class="secondary" data-cookie-action="save">Save choices</button>' +
            '<button data-cookie-action="accept">Accept all</button>' +
          '</footer>' +
        '</article>' +
      '</dialog>';
    document.body.appendChild(root);
    bindUI(root);
  }

  function showBanner(show) {
    var banner = document.querySelector('.cookie-banner');
    if (banner) banner.classList.toggle('is-visible', !!show);
  }

  function showPreferences() {
    buildUI();
    var prefs = readPrefs();
    var analytics = document.getElementById('cookie-analytics');
    var advertising = document.getElementById('cookie-advertising');
    if (analytics) analytics.checked = !!prefs.analytics;
    if (advertising) advertising.checked = !!prefs.advertising;
    var modal = document.getElementById('cookie-preferences-modal');
    if (modal && typeof modal.showModal === 'function') modal.showModal();
    else if (modal) modal.setAttribute('open', 'open');
  }

  function closePreferences() {
    var modal = document.getElementById('cookie-preferences-modal');
    if (modal && typeof modal.close === 'function') modal.close();
    else if (modal) modal.removeAttribute('open');
  }

  function bindUI(root) {
    root.addEventListener('click', function (event) {
      var actionEl = event.target.closest('[data-cookie-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-cookie-action');
      if (action === 'accept') {
        writePrefs({ analytics: true, advertising: true });
        showBanner(false);
        closePreferences();
      }
      if (action === 'decline') {
        writePrefs({ analytics: false, advertising: false });
        showBanner(false);
        closePreferences();
      }
      if (action === 'customize') showPreferences();
      if (action === 'save') {
        writePrefs({
          analytics: !!document.getElementById('cookie-analytics').checked,
          advertising: !!document.getElementById('cookie-advertising').checked
        });
        showBanner(false);
        closePreferences();
      }
      if (action === 'close') closePreferences();
    });
  }

  window.CookieConsent = {
    getPreferences: function () { return clone(readPrefs()); },
    hasConsent: function (category) { return !!readPrefs()[category]; },
    showPreferences: showPreferences,
    reset: function () {
      localStorage.removeItem(STORAGE_KEY);
      showBanner(true);
      applyPrefs(readPrefs());
    },
    onChange: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (item) { return item !== fn; });
      };
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var prefs = readPrefs();
    buildUI();
    applyPrefs(prefs);
    showBanner(!prefs.decided);
    document.querySelectorAll('[data-open-cookie-preferences]').forEach(function (button) {
      button.addEventListener('click', showPreferences);
    });
    window.dispatchEvent(new CustomEvent('cookie-consent:ready', {
      detail: { preferences: clone(prefs) }
    }));
  });
})();
