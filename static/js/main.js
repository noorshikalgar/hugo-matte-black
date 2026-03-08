/**
 * main.js — Core site functionality
 * Hamburger, layout toggle, scroll-to-top, copy buttons,
 * TOC toggle, image lightbox.
 */

(function () {
  'use strict';

  /* ── Hamburger menu ────────────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = mobileNav.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
        mobileNav.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── "More ▾" overflow nav dropdown ────────────────────────── */
  const moreBtn      = document.getElementById('nav-more-btn');
  const moreDropdown = document.getElementById('nav-more-dropdown');

  if (moreBtn && moreDropdown) {
    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = moreDropdown.classList.toggle('open');
      moreBtn.setAttribute('aria-expanded', isOpen);
    });
    document.addEventListener('click', function (e) {
      if (!moreDropdown.contains(e.target) && !moreBtn.contains(e.target)) {
        moreDropdown.classList.remove('open');
        moreBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Theme switcher ─────────────────────────────────────────── */
  var THEMES = ['amber', 'tokyo', 'ayu', 'forest', 'gruvbox', 'graymatter', 'rosepine', 'rosepinedark', 'slate', 'naval', 'deep-blur-gold', 'mocha', 'dracula', 'nord', 'onedark', 'github-light', 'cyber-minimalist', 'ghost-archive'];
  var THEME_NAMES = {
    amber:          'Amber',
    tokyo:          'Tokyo Night',
    ayu:            'Ayu Mirage',
    forest:         'Forest',
    gruvbox:        'Gruvbox Dark',
    graymatter:     'Gray Matter',
    rosepine:       'Rosé Pine Dawn',
    rosepinedark:   'Rosé Pine',
    slate:          'Slate',
    naval:          'Naval',
    'deep-blur-gold': 'Deep Blur Gold',
    mocha:          'Catppuccin Mocha',
    dracula:        'Dracula',
    nord:           'Nord',
    onedark:        'One Dark Pro',
    'github-light': 'GitHub Light',
    'cyber-minimalist': 'Cyber Minimalist',
    'ghost-archive': 'Ghost Archive'
  };

  function applyAccentTheme(name) {
    document.documentElement.setAttribute('data-accent', name);
    localStorage.setItem('accentTheme', name);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('data-theme-name', THEME_NAMES[name] || name);
  }

  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    // Ensure a theme is always set
    var initial = document.documentElement.getAttribute('data-accent') || 'amber';
    if (!document.documentElement.getAttribute('data-accent')) {
      applyAccentTheme('amber');
    } else {
      // Set tooltip name for whatever was restored from localStorage
      themeToggle.setAttribute('data-theme-name', THEME_NAMES[initial] || initial);
    }

    themeToggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-accent') || 'amber';
      var idx     = THEMES.indexOf(current);
      var next    = THEMES[(idx + 1) % THEMES.length];
      applyAccentTheme(next);
      // Show label briefly on touch devices (no hover available)
      themeToggle.classList.add('show-label');
      clearTimeout(themeToggle._labelTimer);
      themeToggle._labelTimer = setTimeout(function () {
        themeToggle.classList.remove('show-label');
      }, 1800);
    });
  }

  /* ── Scroll to top ──────────────────────────────────────────── */
  const scrollBtn = document.getElementById('scrollToTop');

  if (scrollBtn) {
    window.addEventListener('scroll', function () {
      scrollBtn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });

    scrollBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Copy code buttons ──────────────────────────────────────────── */
  function addCopyButtons() {
    document.querySelectorAll('pre code').forEach(function (code) {
      const pre = code.parentNode;

      // Determine the mount point — must be a non-scrolling container so the
      // button stays pinned even when the inner pre scrolls horizontally.
      //
      // Priority:
      //   1. .highlight wrapper (Hugo chroma) — already non-scrolling
      //   2. .pre-copy-wrapper  — injected below for standalone pres
      const highlight = pre.closest('.highlight');
      let mount;

      if (highlight) {
        mount = highlight;
      } else {
        // Wrap standalone pre in a non-scrolling shell (once only)
        let wrapper = pre.parentNode.classList.contains('pre-copy-wrapper')
          ? pre.parentNode
          : null;
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'pre-copy-wrapper';
          pre.parentNode.insertBefore(wrapper, pre);
          wrapper.appendChild(pre);
        }
        mount = wrapper;
      }

      if (mount.querySelector('.copy-button')) return; // already added

      const btn = document.createElement('button');
      btn.className   = 'copy-button';
      btn.textContent = 'copy';
      btn.setAttribute('aria-label', 'Copy code');

      btn.addEventListener('click', async function () {
        try {
          await navigator.clipboard.writeText(code.textContent);
          btn.textContent = 'copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'copy';
            btn.classList.remove('copied');
          }, 2000);
        } catch (_) {
          btn.textContent = 'failed';
          setTimeout(function () { btn.textContent = 'copy'; }, 1500);
        }
      });

      mount.appendChild(btn);
    });
  }

  addCopyButtons();

  /* ── TOC toggle ─────────────────────────────────────────────── */
  const tocHeader  = document.getElementById('toc-header');
  const tocToggle  = document.getElementById('toc-toggle');
  const tocContent = document.getElementById('toc-content');

  if (tocHeader && tocContent) {
    tocHeader.addEventListener('click', function () {
      const isCollapsed = tocContent.classList.toggle('collapsed');
      if (tocToggle) tocToggle.textContent = isCollapsed ? '▶' : '▼';
      tocHeader.setAttribute('aria-expanded', !isCollapsed);
    });

    tocHeader.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tocHeader.click();
      }
    });
  }

  /* ── Sidebar TOC tab toggle ─────────────────────────────────── */
  const contentLayout = document.querySelector('.content-layout');
  const drawerTab     = document.getElementById('sidebar-toc-toggle');

  const closeBtn = document.getElementById('sidebar-toc-close');

  if (contentLayout && drawerTab) {
    drawerTab.addEventListener('click', function () {
      contentLayout.classList.add('toc-open');
    });
  }
  if (contentLayout && closeBtn) {
    closeBtn.addEventListener('click', function () {
      contentLayout.classList.remove('toc-open');
    });
  }

  /* ── Measure header height → CSS variable ─────────────────── */
  const siteHeader = document.querySelector('.site-header');
  function setHeaderVar() {
    if (siteHeader) {
      document.documentElement.style.setProperty(
        '--site-header-h', siteHeader.getBoundingClientRect().height + 'px'
      );
    }
  }
  setHeaderVar();
  window.addEventListener('resize', setHeaderVar);

  /* ── TOC scroll-spy (highlight current section) ───────────────── */
  (function () {
    var allTocLinks = Array.from(document.querySelectorAll('.toc-content a[href^="#"]'));
    if (!allTocLinks.length) return;
    var headingIds = allTocLinks.map(function (a) { return a.getAttribute('href').slice(1); });
    var headings   = headingIds.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!headings.length) return;

    function setActive(id) {
      allTocLinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + id) {
          a.classList.add('toc-active');
        } else {
          a.classList.remove('toc-active');
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, {
      rootMargin: '-' + (Math.round((siteHeader ? siteHeader.getBoundingClientRect().height : 60) + 8)) + 'px 0px -70% 0px',
      threshold: 0
    });

    headings.forEach(function (h) { observer.observe(h); });
    // Set first as active by default
    setActive(headings[0].id);
  }());

  /* ── TOC smooth scroll (with header offset) ─────────────────── */
  const tocAnchors = document.querySelectorAll(
    '.toc-content a[href^="#"]'
  );

  if (tocAnchors.length) {
    tocAnchors.forEach(function (a) {
      a.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const h = siteHeader ? siteHeader.getBoundingClientRect().height : 60;
        const gap = 16;
        const y = target.getBoundingClientRect().top + window.scrollY - h - gap;
        window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
        if (history && history.replaceState) history.replaceState(null, '', id);
      });
    });
  }

  /* ── Image lightbox ─────────────────────────────────────────── */
  const lightbox  = document.getElementById('image-lightbox');
  const lbImage   = document.getElementById('lb-image');
  const lbOverlay = document.getElementById('lightbox-overlay');
  const lbClose   = document.getElementById('lb-close');

  if (lightbox && lbImage) {
    function openLightbox(src, alt) {
      lbImage.src = src;
      lbImage.alt = alt || '';
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      lbImage.src = '';
    }

    // Make content images and featured image clickable
    document.querySelectorAll('.post-content img, .post-featured-image img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        openLightbox(this.src, this.alt);
      });
    });

    lbOverlay.addEventListener('click', closeLightbox);
    if (lbClose) lbClose.addEventListener('click', closeLightbox);

    // Keyboard: Escape to close
    document.addEventListener('keydown', function (e) {
      if (lightbox.classList.contains('open') && e.key === 'Escape') closeLightbox();
    });
  }

  /* ── Smooth active nav link ─────────────────────────────────── */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-desktop a, .nav-mobile a').forEach(function (a) {
    if (a.getAttribute('href') === currentPath) {
      a.classList.add('active');
    }
  });

})();
