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

  /* ── Layout toggle (grid ↔ single column) ───────────────────── */
  const layoutToggle = document.getElementById('layout-toggle');
  const layoutIcon   = document.getElementById('layout-icon');
  const postsGrid    = document.getElementById('posts-container');

  if (layoutToggle && postsGrid) {
    // Restore saved preference
    if (localStorage.getItem('postsLayout') === 'single') {
      postsGrid.classList.add('single-column');
      if (layoutIcon) layoutIcon.textContent = '☰';
    }

    layoutToggle.addEventListener('click', function () {
      const isSingle = postsGrid.classList.toggle('single-column');
      if (layoutIcon) layoutIcon.textContent = isSingle ? '☰' : '⊞';
      localStorage.setItem('postsLayout', isSingle ? 'single' : 'multi');
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

  /* ── Copy code buttons ──────────────────────────────────────── */
  function addCopyButtons() {
    document.querySelectorAll('pre code').forEach(function (code) {
      const pre = code.parentNode;
      if (pre.querySelector('.copy-button')) return; // already added

      const btn  = document.createElement('button');
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

      pre.style.position = 'relative';
      pre.appendChild(btn);
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
  const lightbox     = document.getElementById('image-lightbox');
  const lbImage      = document.getElementById('lb-image');
  const lbContainer  = document.getElementById('lb-image-container');
  const lbOverlay    = document.getElementById('lightbox-overlay');
  const lbClose      = document.getElementById('lb-close');
  const lbZoomIn     = document.getElementById('lb-zoom-in');
  const lbZoomOut    = document.getElementById('lb-zoom-out');
  const lbZoomReset  = document.getElementById('lb-zoom-reset');

  if (lightbox && lbImage) {
    let scale = 1;
    let tx = 0, ty = 0;
    let dragging = false, startX, startY;

    function applyTransform() {
      lbImage.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;
    }

    function openLightbox(src, alt) {
      lbImage.src = src;
      lbImage.alt = alt || '';
      scale = 1; tx = 0; ty = 0;
      applyTransform();
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      lbImage.src = '';
    }

    // Make content images clickable
    document.querySelectorAll('.post-content img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        openLightbox(this.src, this.alt);
      });
    });

    lbOverlay.addEventListener('click', closeLightbox);
    if (lbClose) lbClose.addEventListener('click', closeLightbox);

    if (lbZoomIn)    lbZoomIn.addEventListener('click',    function () { scale = Math.min(scale + 0.25, 5); applyTransform(); });
    if (lbZoomOut)   lbZoomOut.addEventListener('click',   function () { scale = Math.max(scale - 0.25, 0.5); tx = 0; ty = 0; applyTransform(); });
    if (lbZoomReset) lbZoomReset.addEventListener('click', function () { scale = 1; tx = 0; ty = 0; applyTransform(); });

    // Mouse wheel zoom
    lbContainer.addEventListener('wheel', function (e) {
      e.preventDefault();
      scale = e.deltaY < 0
        ? Math.min(scale + 0.15, 5)
        : Math.max(scale - 0.15, 0.5);
      applyTransform();
    }, { passive: false });

    // Drag pan
    lbImage.addEventListener('mousedown', function (e) {
      if (scale <= 1) return;
      dragging = true; startX = e.clientX - tx; startY = e.clientY - ty;
      lbImage.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      tx = e.clientX - startX; ty = e.clientY - startY;
      applyTransform();
    });
    document.addEventListener('mouseup', function () {
      if (dragging) { dragging = false; lbImage.style.cursor = 'grab'; }
    });

    // Keyboard
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === '+' || e.key === '=') { scale = Math.min(scale + 0.25, 5); applyTransform(); }
      if (e.key === '-') { scale = Math.max(scale - 0.25, 0.5); applyTransform(); }
      if (e.key === '0') { scale = 1; tx = 0; ty = 0; applyTransform(); }
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
