/**
 * kroki.js — Client-side Kroki diagram renderer
 * Finds .kroki-shortcode elements and fetches SVG from the
 * configured Kroki endpoint (default: https://kroki.io).
 * Uses the POST API — no compression dependency needed.
 */

(function () {
  'use strict';

  var cfg = window.krokiConfig || {};
  var ENDPOINT   = (cfg.endpoint   || 'https://kroki.io').replace(/\/$/, '');
  var USE_CACHE  = cfg.cache     !== false;
  var LAZY       = cfg.lazyLoad  !== false;
  var TIMEOUT_MS = cfg.timeout   || 10000;
  var RETRIES    = cfg.retryCount || 1;

  /* Simple in-memory SVG cache (keyed by type+source) */
  var _cache = {};

  /* ── Fetch SVG from Kroki endpoint ─────────────────────────── */
  function fetchDiagram(type, source, attempt, callback) {
    var url = ENDPOINT + '/' + type + '/svg';
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: source,
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (svg) {
        callback(null, svg);
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (attempt < RETRIES) {
          fetchDiagram(type, source, attempt + 1, callback);
        } else {
          callback(err, null);
        }
      });
  }

  /* ── Render one element ─────────────────────────────────────── */
  function renderEl(el) {
    if (el.dataset.krokiRendered) return;
    el.dataset.krokiRendered = '1';

    var type    = el.dataset.type || 'graphviz';
    var codeEl  = el.querySelector('pre code');
    var loading = el.querySelector('.kroki-loading');

    if (!codeEl) {
      if (loading) loading.textContent = 'Error: no diagram source found.';
      return;
    }

    var source = codeEl.textContent.trim();
    var cacheKey = type + '\x00' + source;

    function insert(svg) {
      var wrapper = document.createElement('div');
      wrapper.className = 'kroki-diagram';
      wrapper.innerHTML = svg;
      /* Make SVG responsive */
      var svgEl = wrapper.querySelector('svg');
      if (svgEl) {
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.maxWidth = '100%';
        svgEl.style.height   = 'auto';
      }
      if (loading) {
        el.replaceChild(wrapper, loading);
      } else {
        el.appendChild(wrapper);
      }
    }

    if (USE_CACHE && _cache[cacheKey]) {
      insert(_cache[cacheKey]);
      return;
    }

    fetchDiagram(type, source, 0, function (err, svg) {
      if (err) {
        if (loading) loading.textContent = 'Diagram error: ' + (err.message || err);
        console.warn('[kroki.js] Failed to render ' + type + ' diagram:', err);
        return;
      }
      if (USE_CACHE) _cache[cacheKey] = svg;
      insert(svg);
    });
  }

  /* ── Main — observe or render immediately ───────────────────── */
  function init() {
    var els = document.querySelectorAll('.kroki-shortcode');
    if (!els.length) return;

    if (LAZY && typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            io.unobserve(entry.target);
            renderEl(entry.target);
          }
        });
      }, { rootMargin: '200px' });

      els.forEach(function (el) { io.observe(el); });
    } else {
      /* Render everything immediately */
      els.forEach(renderEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
