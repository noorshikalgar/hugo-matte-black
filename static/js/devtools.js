/**
 * devtools.js — Theme Lab v2
 * Localhost / dev-server only. Loaded conditionally by baseof.html
 * when hugo.IsServer is true, so it never reaches production.
 *
 * Each variable row shows: [colour swatch] | [Name + where it's used] | [hex input]
 * - Edit any --mb-* token with a colour picker + text input.
 * - Changes apply instantly (inline style overrides, non-destructive).
 * - "Copy CSS"  → ready-to-paste themes.css block.
 * - "Copy JSON" → mermaid themeVariables object.
 * - "Reset All" → removes all inline overrides, restores theme defaults.
 */
(function () {
  'use strict';

  /* ── Only run on localhost / hugo dev server ─────────────── */
  var h = window.location.hostname;
  if (h !== 'localhost' && h !== '127.0.0.1' && h !== '') return;

  /* ── Variable catalogue ──────────────────────────────────── */
  /*    Every entry: { v: CSS var, label: short name, desc: usage hint } */
  var GROUPS = [
    {
      label: '🗄  Backgrounds',
      vars: [
        { v: '--mb-bg',        label: 'Page',      desc: 'Main page & body fill — largest colour on screen' },
        { v: '--mb-surface-1', label: 'Surface 1', desc: 'Cards, code blocks, sidebars, post-cards' },
        { v: '--mb-surface-2', label: 'Surface 2', desc: 'Form inputs, table rows, active editor line' },
        { v: '--mb-surface-3', label: 'Surface 3', desc: 'Hover states, dropdowns, tooltip backgrounds' }
      ]
    },
    {
      label: '▭  Borders',
      vars: [
        { v: '--mb-border',        label: 'Default', desc: 'Dividers, card outlines, table grid lines' },
        { v: '--mb-border-focus',  label: 'Focus',   desc: 'Ring around focused inputs & selected nav items' },
        { v: '--mb-border-accent', label: 'Accent',  desc: 'Accent-tinted border (8-digit hex with alpha typical)' }
      ]
    },
    {
      label: '𝐓  Text',
      vars: [
        { v: '--mb-text-bright',   label: 'Heading H1', desc: 'Page titles — highest contrast on any background' },
        { v: '--mb-text',          label: 'Body',       desc: 'Body copy, H2, most readable content' },
        { v: '--mb-text-muted',    label: 'Secondary',  desc: 'H3, meta labels, breadcrumbs, reading-time' },
        { v: '--mb-text-faint',    label: 'Placeholder',desc: 'H4, input placeholders, empty-state hints' },
        { v: '--mb-text-disabled', label: 'Disabled',   desc: 'Greyed-out controls and inactive menu items' }
      ]
    },
    {
      label: '◉  Accent',
      vars: [
        { v: '--mb-accent',        label: 'Primary',   desc: 'Links, nav active indicator, icon fill, theme dot' },
        { v: '--mb-accent-bright', label: 'Bright',    desc: 'Bold / highlighted text, hovered links' },
        { v: '--mb-accent-dark',   label: 'Dark',      desc: 'Tag chips, pressed button backgrounds' },
        { v: '--mb-accent-dim',    label: 'Dim',       desc: 'Visited links, subtle inline accents' },
        { v: '--mb-accent-bg',     label: 'Tint',      desc: 'Highlighted table rows, selected-item wash' },
        { v: '--mb-accent-bg-sel', label: 'Selection', desc: 'Text-selection background on the page' }
      ]
    },
    {
      label: '✓  Success',
      vars: [
        { v: '--mb-green',        label: 'Green',      desc: 'DONE badge, passing test, success callout text' },
        { v: '--mb-green-bright', label: 'Bright',     desc: 'Hover / emphasis on success elements' },
        { v: '--mb-green-bg',     label: 'Background', desc: 'Success alert / toast tinted background' }
      ]
    },
    {
      label: '✕  Danger',
      vars: [
        { v: '--mb-red',        label: 'Red',        desc: 'Error text, delete button, failed-test indicator' },
        { v: '--mb-red-bright', label: 'Bright',     desc: 'Hover / emphasis on danger elements' },
        { v: '--mb-red-bg',     label: 'Background', desc: 'Error alert / destructive-action tinted background' }
      ]
    },
    {
      label: 'ℹ  Info & Warning',
      vars: [
        { v: '--mb-blue',        label: 'Blue',          desc: 'Info callout text, directive block accent' },
        { v: '--mb-blue-bright', label: 'Blue Bright',   desc: 'Hover / emphasis on info elements' },
        { v: '--mb-blue-bg',     label: 'Blue Tint',     desc: 'Info callout background fill' },
        { v: '--mb-warning',     label: 'Warning',       desc: 'Caution text, WIP badge, rate-limit notice' },
        { v: '--mb-warning-bg',  label: 'Warning Tint',  desc: 'Warning callout background fill' },
        { v: '--mb-info',        label: 'Info Accent',   desc: '"Created" date badge, generic info indicator' },
        { v: '--mb-info-bg',     label: 'Info Tint',     desc: 'Info badge background fill' }
      ]
    },
    {
      label: '↕  Scrollbar',
      vars: [
        { v: '--mb-scrollbar',       label: 'Thumb',       desc: 'Scrollbar thumb colour (resting state)' },
        { v: '--mb-scrollbar-hover', label: 'Thumb Hover', desc: 'Scrollbar thumb colour on mouse-over' }
      ]
    }
  ];

  /* ── Helpers ─────────────────────────────────────────────── */
  function getVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function toSolid(v) {
    v = (v || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
    if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
    if (/^#[0-9a-fA-F]{3}$/.test(v)) return '#' + v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
    return null;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* ── Panel CSS (fully self-contained, not using theme vars) ─ */
  var STYLES = [
    /* FAB */
    '#dt-fab{position:fixed;bottom:80px;left:16px;width:44px;height:44px;',
    'border-radius:50%;background:#ff9b51;border:2px solid #c47020;',
    'cursor:pointer;font-size:20px;z-index:999990;',
    'box-shadow:0 2px 14px rgba(0,0,0,.6);',
    'display:flex;align-items:center;justify-content:center;',
    'line-height:1;padding:0;transition:transform .15s,box-shadow .15s;}',
    '#dt-fab:hover{transform:scale(1.1);box-shadow:0 4px 22px rgba(255,155,81,.5);}',
    '#dt-fab.open{background:#252525;border-color:#555;font-size:16px;}',

    /* Overlay */
    '#dt-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:999991;}',
    '#dt-overlay.open{display:block;}',

    /* Panel */
    '#dt-panel{position:fixed;top:0;right:-440px;width:420px;height:100dvh;',
    'background:#141414;border-left:1px solid #262626;z-index:999992;',
    'display:flex;flex-direction:column;',
    'transition:right .27s cubic-bezier(.4,0,.2,1);',
    'font-family:"JetBrains Mono","Fira Code",ui-monospace,monospace;',
    'font-size:11.5px;color:#ccc;}',
    '#dt-panel.open{right:0;}',

    /* Header */
    '#dt-hdr{display:flex;align-items:center;gap:8px;padding:11px 14px;',
    'border-bottom:1px solid #242424;background:#1c1c1c;flex-shrink:0;}',
    '#dt-title{flex:1;font-size:13px;font-weight:700;color:#ff9b51;',
    'white-space:nowrap;letter-spacing:.02em;}',
    '#dt-theme-name{width:115px;padding:5px 8px;background:#1a1a1a;',
    'border:1px solid #383838;border-radius:5px;color:#eee;',
    'font-family:inherit;font-size:10px;outline:none;}',
    '#dt-theme-name:focus{border-color:#ff9b51;box-shadow:0 0 0 2px rgba(255,155,81,.15);}',
    '#dt-close-btn{background:none;border:1px solid #383838;padding:4px 10px;',
    'border-radius:5px;color:#777;cursor:pointer;font-size:14px;line-height:1;}',
    '#dt-close-btn:hover{border-color:#888;color:#eee;}',

    /* Body */
    '#dt-body{flex:1;overflow-y:auto;padding:0;',
    'scrollbar-width:thin;scrollbar-color:#282828 #141414;}',

    /* Groups */
    '.dt-grp{border-bottom:1px solid #1e1e1e;}',
    '.dt-ghdr{display:flex;align-items:center;justify-content:space-between;',
    'padding:9px 14px;cursor:pointer;background:#1c1c1c;',
    'font-size:9.5px;font-weight:700;letter-spacing:.09em;',
    'text-transform:uppercase;color:#888;user-select:none;}',
    '.dt-ghdr:hover{color:#ccc;background:#222;}',
    '.dt-ghdr .chv{font-size:8px;transition:transform .15s;opacity:.7;}',
    '.dt-ghdr.clpsd .chv{transform:rotate(-90deg);}',
    '.dt-grows{padding:3px 0 5px;}',
    '.dt-grows.clpsd{display:none;}',

    /* Row — 3-column grid: fixed swatch | meta | fixed input */
    '.dt-row{display:grid;grid-template-columns:26px 1fr 96px;',
    'align-items:center;gap:9px;padding:5px 14px;}',
    '.dt-row:hover{background:#1d1d1d;}',

    /* Swatch — explicit fixed size so it never expands */
    '.dt-sw{display:block!important;',
    'width:22px!important;height:22px!important;',
    'min-width:22px!important;max-width:22px!important;',
    'border-radius:5px;border:1px solid #3c3c3c;',
    'cursor:pointer;padding:0;flex-shrink:0;',
    '-webkit-appearance:none;appearance:none;}',
    '.dt-sw::-webkit-color-swatch-wrapper{padding:0;}',
    '.dt-sw::-webkit-color-swatch{border:none;border-radius:4px;}',
    '.dt-sw::-moz-color-swatch{border:none;border-radius:4px;}',
    /* Placeholder for vars that aren't a plain hex (e.g. alpha hex) */
    '.dt-sw-na{display:block;width:22px;height:22px;border-radius:5px;',
    'border:1px dashed #444;background:repeating-linear-gradient(',
    '-45deg,#222,#222 3px,#2a2a2a 3px,#2a2a2a 6px);flex-shrink:0;}',

    /* Meta column: name (bold) + description (muted italic below) */
    '.dt-meta{display:flex;flex-direction:column;gap:2px;min-width:0;}',
    '.dt-lbl{font-size:10.5px;font-weight:700;color:#d4d4d4;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;}',
    '.dt-dsc{font-size:8.5px;color:#4a4a4a;font-style:italic;line-height:1.3;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dt-row:hover .dt-dsc{color:#6a6a6a;}',

    /* Text input */
    '.dt-inp{width:96px!important;box-sizing:border-box;padding:4px 6px;',
    'background:#191919;border:1px solid #2e2e2e;border-radius:4px;',
    'color:#aaa;font-family:inherit;font-size:9px;outline:none;}',
    '.dt-inp:focus{border-color:#ff9b51;color:#eee;',
    'box-shadow:0 0 0 2px rgba(255,155,81,.12);}',
    '.dt-inp.mod{border-color:rgba(255,155,81,.4);color:#ffb47a;}',

    /* Footer */
    '#dt-ftr{padding:11px 14px;border-top:1px solid #222;background:#1c1c1c;',
    'flex-shrink:0;display:flex;gap:7px;}',
    '#dt-ftr button{flex:1;padding:7px 4px;border-radius:5px;',
    'cursor:pointer;font-family:inherit;font-size:9.5px;font-weight:700;',
    'letter-spacing:.04em;border:1px solid transparent;transition:filter .1s;}',
    '#dt-ftr button:hover{filter:brightness(1.18);}',
    '#dt-btn-css{background:#163016;border-color:#2d5c2d;color:#74c274;}',
    '#dt-btn-json{background:#141e2a;border-color:#2a4a68;color:#6aa8c8;}',
    '#dt-btn-reset{background:#2a1414;border-color:#5c2d2d;color:#c27474;}',

    /* Toast */
    '#dt-toast{position:fixed;bottom:132px;left:12px;',
    'background:#163016;color:#74c274;border:1px solid #2d5c2d;',
    'border-radius:6px;padding:8px 13px;font-size:10px;',
    'font-family:"JetBrains Mono",monospace;z-index:999993;',
    'opacity:0;pointer-events:none;transition:opacity .18s;max-width:300px;}',
    '#dt-toast.show{opacity:1;}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  /* ── State ───────────────────────────────────────────────── */
  var modified = {};

  /* ── Build one variable row ──────────────────────────────── */
  function buildRow(def) {
    var val    = getVar(def.v);
    var solid  = toSolid(val);
    var modCls = modified[def.v] ? ' mod' : '';
    var swHtml = solid
      ? '<input class="dt-sw" type="color" data-var="' + esc(def.v) + '" value="' + esc(solid) + '" title="' + esc(def.v) + '">'
      : '<span class="dt-sw-na" title="' + esc(def.v) + ' = ' + esc(val || 'unset') + '"></span>';
    return '<div class="dt-row">'
      + swHtml
      + '<div class="dt-meta">'
      +   '<span class="dt-lbl">' + esc(def.label) + '</span>'
      +   '<span class="dt-dsc" title="' + esc(def.desc) + '">' + esc(def.desc) + '</span>'
      + '</div>'
      + '<input class="dt-inp' + modCls + '" data-var="' + esc(def.v) + '" value="' + esc(val) + '" spellcheck="false">'
      + '</div>';
  }

  function buildPanel() {
    var accent = document.documentElement.getAttribute('data-accent') || 'amber';
    var rows = GROUPS.map(function (g) {
      return '<div class="dt-grp">'
        + '<div class="dt-ghdr"><span>' + esc(g.label) + '</span><span class="chv">▾</span></div>'
        + '<div class="dt-grows">' + g.vars.map(buildRow).join('') + '</div>'
        + '</div>';
    }).join('');

    return '<div id="dt-hdr">'
      + '<div id="dt-title">🎨 Theme Lab</div>'
      + '<input id="dt-theme-name" type="text" value="' + esc(accent) + '-edit" placeholder="theme-key">'
      + '<button id="dt-close-btn" title="Close">✕</button>'
      + '</div>'
      + '<div id="dt-body">' + rows + '</div>'
      + '<div id="dt-ftr">'
      + '<button id="dt-btn-css"   title="Copy CSS block → paste into themes.css">Copy CSS</button>'
      + '<button id="dt-btn-json"  title="Copy mermaid JSON → paste into mermaid.html">Copy JSON</button>'
      + '<button id="dt-btn-reset" title="Remove all live tweaks, restore theme defaults">Reset All</button>'
      + '</div>';
  }

  /* ── DOM elements ────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.id = 'dt-fab';
  fab.title = 'Theme Lab  (dev only)';
  fab.textContent = '🎨';
  document.body.appendChild(fab);

  var overlay = document.createElement('div');
  overlay.id = 'dt-overlay';
  document.body.appendChild(overlay);

  var panel = document.createElement('div');
  panel.id = 'dt-panel';
  document.body.appendChild(panel);

  var toast = document.createElement('div');
  toast.id = 'dt-toast';
  document.body.appendChild(toast);

  /* ── Toast helper ────────────────────────────────────────── */
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* ── Open / close ────────────────────────────────────────── */
  function openPanel() {
    panel.innerHTML = buildPanel();
    bindEvents();
    panel.classList.add('open');
    overlay.classList.add('open');
    fab.classList.add('open');
    fab.textContent = '✕';
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('open');
    fab.classList.remove('open');
    fab.textContent = '🎨';
  }

  /* ── Apply a change ──────────────────────────────────────── */
  function applyVar(varName, value) {
    document.documentElement.style.setProperty(varName, value);
    modified[varName] = value;
  }

  /* ── Generators ──────────────────────────────────────────── */
  function generateCSS() {
    var name  = (document.getElementById('dt-theme-name').value || 'custom').trim();
    var lines = ['html[data-accent="' + name + '"] {'];
    GROUPS.forEach(function (g) {
      lines.push('  /* ' + g.label.replace(/^\S+\s+/, '') + ' */');
      g.vars.forEach(function (def) {
        var val = getComputedStyle(document.documentElement).getPropertyValue(def.v).trim();
        lines.push('  ' + def.v + ': ' + val + ';');
      });
    });
    lines.push('}');
    return lines.join('\n');
  }

  function generateJSON() {
    /* Produces a mermaid themeVariables-compatible object for the theme */
    var bg      = getVar('--mb-bg');
    var surf1   = getVar('--mb-surface-1');
    var surf2   = getVar('--mb-surface-2');
    var textB   = getVar('--mb-text-bright');
    var text    = getVar('--mb-text');
    var accent  = getVar('--mb-accent');
    var border  = getVar('--mb-border');
    var accentB = getVar('--mb-accent-bright');

    var isLight = (function() {
      var c = (bg || '#000').replace('#','');
      if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      var r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000 > 128;
    }());

    var obj = {
      darkMode:            !isLight,
      background:          bg,
      primaryColor:        surf1,
      primaryTextColor:    textB,
      primaryBorderColor:  border,
      lineColor:           accent,
      secondaryColor:      bg,
      tertiaryColor:       surf2,
      edgeLabelBackground: bg,
      textColor:           text,
      clusterBkg:          surf1,
      clusterBorder:       border,
      titleColor:          accentB || accent,
      nodeBorder:          border,
      mainBkg:             surf1,
      nodeTextColor:       textB,
      labelBackground:     bg
    };

    var name = (document.getElementById('dt-theme-name').value || 'custom').trim();
    return '    ' + name + ': ' + JSON.stringify(obj, null, 6).replace(/\n/g, '\n    ') + ',';
  }

  /* ── Bind panel-internal events ──────────────────────────── */
  function bindEvents() {
    /* group collapse */
    panel.querySelectorAll('.dt-ghdr').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        hdr.classList.toggle('clpsd');
        hdr.nextElementSibling.classList.toggle('clpsd');
      });
    });

    /* text inputs — live update */
    panel.querySelectorAll('.dt-inp').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = inp.dataset.var;
        var val = inp.value;
        applyVar(v, val);
        inp.classList.add('mod');
        var solid = toSolid(val);
        if (solid) {
          var sw = panel.querySelector('.dt-sw[data-var="' + v + '"]');
          if (sw && sw.tagName === 'INPUT') sw.value = solid;
        }
      });
    });

    /* colour swatches */
    panel.querySelectorAll('.dt-sw').forEach(function (sw) {
      if (sw.tagName !== 'INPUT') return;
      sw.addEventListener('input', function () {
        var v   = sw.dataset.var;
        var val = sw.value;
        /* Preserve alpha suffix if original value had 8-digit hex */
        var orig = getVar(v);
        if (/^#[0-9a-fA-F]{8}$/.test(orig)) val = val + orig.slice(7);
        applyVar(v, val);
        var inp = panel.querySelector('.dt-inp[data-var="' + v + '"]');
        if (inp) { inp.value = val; inp.classList.add('mod'); }
      });
    });

    /* Copy CSS */
    document.getElementById('dt-btn-css').addEventListener('click', function () {
      var css = generateCSS();
      navigator.clipboard.writeText(css).then(function () {
        showToast('✓ CSS block copied — paste into themes.css');
      }).catch(function () {
        prompt('Copy the CSS:', css);
      });
    });

    /* Copy JSON */
    document.getElementById('dt-btn-json').addEventListener('click', function () {
      var json = generateJSON();
      navigator.clipboard.writeText(json).then(function () {
        showToast('✓ Mermaid JSON copied — paste into mermaid.html');
      }).catch(function () {
        prompt('Copy the JSON:', json);
      });
    });

    /* Reset */
    document.getElementById('dt-btn-reset').addEventListener('click', function () {
      GROUPS.forEach(function (g) {
        g.vars.forEach(function (def) {
          document.documentElement.style.removeProperty(def.v);
        });
      });
      modified = {};
      setTimeout(function () { panel.innerHTML = buildPanel(); bindEvents(); }, 30);
      showToast('↺ Reset to theme defaults');
    });

    /* Close button */
    document.getElementById('dt-close-btn').addEventListener('click', closePanel);
  }

  /* ── FAB click ───────────────────────────────────────────── */
  fab.addEventListener('click', function () {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  /* ── Overlay click closes panel ──────────────────────────── */
  overlay.addEventListener('click', closePanel);

  /* ── Refresh panel when theme toggle fires ───────────────── */
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.attributeName === 'data-accent' && panel.classList.contains('open')) {
        modified = {};
        setTimeout(function () {
          panel.innerHTML = buildPanel();
          bindEvents();
        }, 60);
      }
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent'] });

}());
