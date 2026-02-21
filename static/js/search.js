/**
 * search.js — Site search for 1200+ SSG pages
 * Loads /index.json, debounces input, scores results by
 * title/tag/content, supports section filters and sorting.
 * No external dependencies.
 */

(function () {
  'use strict';

  /* ── Elements ────────────────────────────────────────────────── */
  const searchInput   = document.getElementById('search-input');
  const searchForm    = document.getElementById('search-form');
  const resultsEl     = document.getElementById('search-results');
  const emptyEl       = document.getElementById('search-empty');
  const emptyQuery    = document.getElementById('empty-query');
  const loadingEl     = document.getElementById('search-loading');
  const metaBar       = document.getElementById('results-meta');
  const resultsCount  = document.getElementById('results-count');
  const browseSection = document.getElementById('browse-section');
  const sortSelect    = document.getElementById('sort-select');
  const filterChips   = document.querySelectorAll('.filter-chip[data-filter="section"]');


  if (!searchInput) return;

  /* ── State ───────────────────────────────────────────────────── */
  let index         = null;
  let isLoading     = false;   // guard against duplicate fetches
  let query         = '';
  let activeSection = '';   // '' = all
  let activeSort    = 'relevance';
  let loadError     = false;

  /* ── Load index ──────────────────────────────────────────────── */
  /* silent=true: fetch in background without showing the spinner  */
  function loadIndex(silent) {
    if (index || isLoading) {
      // Already loaded or in-flight; if a search is pending, run it now
      if (index && query) runSearch();
      return;
    }
    isLoading = true;
    const indexURL = (window.searchIndexURL) || '/index.json';
    if (!silent) showLoading(true);
    fetch(indexURL)
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(function (data) {
        index = data;
        isLoading = false;
        if (!silent) showLoading(false);
        if (query || activeSection) runSearch();
      })
      .catch(function () {
        loadError = true;
        isLoading = false;
        if (!silent) showLoading(false);
        if (!silent) showError('Could not load search index.');
      });
  }

  /* ── Scoring ─────────────────────────────────────────────────── */
  /** Simple multi-term scoring. Returns score >= 0; 0 = no match. */
  function score(page, terms) {
    let total = 0;
    const title   = (page.title       || '').toLowerCase();
    const tags    = (page.tags        || []).join(' ').toLowerCase();
    const section = (page.section     || '').toLowerCase();
    const desc    = (page.description || '').toLowerCase();
    const content = (page.content     || '').toLowerCase();

    for (const term of terms) {
      if (!term) continue;
      const t = term.toLowerCase();

      const inTitle   = title.indexOf(t);
      const inTags    = tags.indexOf(t) !== -1;
      const inSection = section.indexOf(t) !== -1;
      const inDesc    = desc.indexOf(t)  !== -1;
      const inContent = content.indexOf(t) !== -1;

      if (inTitle !== -1) {
        // Bonus for match at start of title
        total += inTitle === 0 ? 120 : 80;
      }
      if (inTags)    total += 40;
      if (inSection) total += 20;
      if (inDesc)    total += 30;
      if (inContent) total += 10;

      // If nothing matches this term, kill the result
      if (!inTitle !== true || inTitle === -1) {
        if (!inTags && !inSection && !inDesc && !inContent) {
          return 0; // ALL terms must match somewhere
        }
      }
    }
    return total;
  }

  /* ── Run search ──────────────────────────────────────────────── */
  function runSearch() {
    if (!index) { loadIndex(false); return; }

    const q     = query.trim();
    const terms = q.split(/\s+/).filter(Boolean);

    if (!q && !activeSection) {
      showBrowse(true);
      clearResults();
      resetChipCounts();
      return;
    }

    showBrowse(false);

    // All term-matching results (ignoring section) — used for per-chip counts
    let allMatches = index.filter(function (page) {
      if (!terms.length) return true;
      return score(page, terms) > 0;
    });

    // Per-section counts across ALL matches (so inactive chips show their count too)
    const sectionCounts = {};
    allMatches.forEach(function (page) {
      sectionCounts[page.section] = (sectionCounts[page.section] || 0) + 1;
    });

    // Apply section filter for actual display
    let results = activeSection
      ? allMatches.filter(function (page) { return page.section === activeSection; })
      : allMatches.slice();

    // Score + sort
    if (terms.length) {
      results = results.map(function (page) {
        return { page: page, score: score(page, terms) };
      }).sort(function (a, b) {
        if (activeSort === 'relevance') return b.score - a.score;
        if (activeSort === 'date-desc') return (b.page.date || '') > (a.page.date || '') ? 1 : -1;
        if (activeSort === 'date-asc')  return (a.page.date || '') > (b.page.date || '') ? 1 : -1;
        if (activeSort === 'title-asc') return (a.page.title || '').localeCompare(b.page.title || '');
        return 0;
      }).map(function (r) { return r.page; });
    } else {
      results.sort(function (a, b) {
        if (activeSort === 'date-desc') return (b.date || '') > (a.date || '') ? 1 : -1;
        if (activeSort === 'date-asc')  return (a.date || '') > (b.date || '') ? 1 : -1;
        if (activeSort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
        return 0;
      });
    }

    renderResults(results, q, sectionCounts);
  }

  /* ── Chip counts ─────────────────────────────────────────────── */
  function updateChipCounts(sectionCounts) {
    filterChips.forEach(function (chip) {
      const sec   = chip.dataset.value;
      const count = sectionCounts[sec] || 0;
      const base  = sec;
      chip.textContent = count ? base + ' · ' + count : base;
    });
  }

  function resetChipCounts() {
    filterChips.forEach(function (chip) {
      chip.textContent = chip.dataset.value;
    });
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function renderResults(results, q, sectionCounts) {
    updateChipCounts(sectionCounts || {});

    if (!results.length) {
      clearResults();
      if (q || activeSection) {
        emptyEl.style.display  = 'block';
        if (emptyQuery) emptyQuery.textContent = q || activeSection;
      }
      if (metaBar) metaBar.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    if (metaBar) {
      metaBar.style.display = 'flex';
      if (resultsCount) {
        resultsCount.innerHTML =
          '<strong>' + results.length + '</strong> result' +
          (results.length === 1 ? '' : 's') +
          (q ? ' for "' + escHtml(q) + '"' : '');
      }
    }

    const frag = document.createDocumentFragment();

    const wrapper = document.createElement('div');
    wrapper.className = 'search-results';

    results.slice(0, 100).forEach(function (page) {
      const a = document.createElement('a');
      a.className = 'search-result-item';
      a.href      = page.permalink;

      const path = document.createElement('div');
      path.className = 'result-path';

      const pathLeft = document.createElement('span');
      pathLeft.textContent = page.section + (page.date ? ' · ' + page.date : '');
      path.appendChild(pathLeft);

      if (page.readingTime) {
        const rt = document.createElement('span');
        rt.className   = 'result-read-time';
        rt.textContent = page.readingTime + ' min';
        path.appendChild(rt);
      }

      const title = document.createElement('div');
      title.className = 'result-title';
      title.innerHTML = highlight(page.title || 'Untitled', q);

      const excerpt = document.createElement('div');
      excerpt.className = 'result-excerpt';
      excerpt.innerHTML = highlight(page.description || '', q);

      const footer = document.createElement('div');
      footer.className = 'result-footer';

      // Tags (first 3)
      if (page.tags && page.tags.length) {
        page.tags.slice(0, 3).forEach(function (tag) {
          const t = document.createElement('span');
          t.className   = 'tag-chip';
          t.textContent = tag;
          footer.appendChild(t);
        });
      }

      a.appendChild(path);
      a.appendChild(title);
      if (page.description) a.appendChild(excerpt);
      if (footer.children.length) a.appendChild(footer);
      wrapper.appendChild(a);
    });

    frag.appendChild(wrapper);
    resultsEl.innerHTML = '';
    resultsEl.appendChild(frag);
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function highlight(text, q) {
    if (!q || !text) return escHtml(text || '');
    const terms = q.trim().split(/\s+/).filter(Boolean);
    let result  = escHtml(text);
    terms.forEach(function (term) {
      const re = new RegExp('(' + regEsc(escHtml(term)) + ')', 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;');
  }

  function regEsc(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearResults() {
    resultsEl.innerHTML = '';
    emptyEl.style.display = 'none';
  }

  function showBrowse(show) {
    if (browseSection) browseSection.style.display = show ? '' : 'none';
  }

  function showLoading(show) {
    if (loadingEl) loadingEl.style.display = show ? '' : 'none';
  }

  function showError(msg) {
    if (resultsEl) resultsEl.innerHTML =
      '<div class="search-empty"><span class="empty-icon">!</span>' + msg + '</div>';
  }

  /* ── Debounce ────────────────────────────────────────────────── */
  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ── Event listeners ─────────────────────────────────────────── */
  const debouncedSearch = debounce(runSearch, 180);

  searchInput.addEventListener('input', function () {
    query = this.value;
    debouncedSearch();
  });

  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      query = searchInput.value;
      runSearch();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      activeSort = this.value;
      runSearch();
    });
  }

  // Section filter chips
  filterChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      const val = this.dataset.value;
      if (activeSection === val) {
        activeSection = '';
        this.classList.remove('active');
      } else {
        filterChips.forEach(function (c) { c.classList.remove('active'); });
        activeSection = val;
        this.classList.add('active');
      }
      runSearch();
    });
  });

  /* ── Init ─────────────────────────────────────────────────────── */
  // Pre-load index silently in background (consumes preload hint)
  loadIndex(true);

  // Handle URL query param ?q=...
  const urlParams = new URLSearchParams(window.location.search);
  const urlQ      = urlParams.get('q');
  if (urlQ) {
    searchInput.value = urlQ;
    query = urlQ;
    // runSearch will fire once index is loaded
  }

})();
