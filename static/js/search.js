/**
 * search.js — Site search for 1200+ SSG pages
 * Loads /index.json, debounces input, scores results by
 * title/tag/section (default) or +content via content:term syntax.
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
  const filtersContainer = document.getElementById('search-filters');

  if (!searchInput) return;

  /* ── Main sections set (from Hugo params) ────────────────────── */
  const _rawSections = window.searchSections || [];
  const _parsedSections = typeof _rawSections === 'string'
    ? (function () { try { return JSON.parse(_rawSections); } catch (e) { return []; } })()
    : _rawSections;
  const mainSections = new Set(_parsedSections);

  function isChapter(page) {
    return mainSections.size > 0 && !mainSections.has(page.section);
  }

  /* Inject a "chapters" chip dynamically once the index is loaded  */
  function injectChaptersChip() {
    if (!filtersContainer) return;
    if (filtersContainer.querySelector('[data-value="chapters"]')) return;
    const chip = document.createElement('button');
    chip.className     = 'filter-chip';
    chip.dataset.filter = 'section';
    chip.dataset.value  = 'chapters';
    chip.textContent    = 'chapters';
    filtersContainer.appendChild(chip);
  }

  /* ── State ───────────────────────────────────────────────────── */
  let index         = null;
  let isLoading     = false;   // guard against duplicate fetches
  let query         = '';
  let activeSection = '';   // '' = all
  let activeSort    = 'relevance';
  let loadError     = false;

  /* Infinite scroll state */
  const PAGE_SIZE       = 20;
  let   allResults      = [];   // full sorted result list for current search
  let   visibleCount    = 0;    // how many are currently rendered
  let   currentQ        = '';
  let   currentInclude  = false;
  let   scrollObserver  = null;

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
        injectChaptersChip();
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

  /**
   * Check if a page matches a phrase (exact substring match).
   * includeContent=false: title only. true: title+section+desc+content.
   */
  function matchPhrase(page, phrase, includeContent) {
    const p = phrase.toLowerCase();
    const title = (page.title || '').toLowerCase();
    const desc  = (page.description || '').toLowerCase();
    // content: now means title OR description only
    return (
      title.indexOf(p) !== -1 ||
      desc.indexOf(p)  !== -1
    );
  }


  /**
   * Score a page against OR-groups.
   * groups = ["react native", "angular"]  → page matches if ANY phrase matches.
   * Returns score > 0 if matched.
   */
  function score(page, groups, includeContent) {
    let total = 0;
    let anyGroupMatched = false;
    for (const phrase of groups) {
      if (!matchPhrase(page, phrase, includeContent)) continue;
      anyGroupMatched = true;
      // Score based on phrase location
      const p = phrase.toLowerCase();
      const title   = (page.title   || '').toLowerCase();
      const section = includeContent ? (page.section || '').toLowerCase()          : '';
      const desc    = includeContent ? (page.description || '').toLowerCase()      : '';
      const content = includeContent ? (page.content     || '').toLowerCase()      : '';
      if (title.indexOf(p)   !== -1) total += title.indexOf(p) === 0 ? 120 : 80;
      if (section.indexOf(p) !== -1) total += 20;
      if (desc.indexOf(p)    !== -1) total += 30;
      if (content.indexOf(p) !== -1) total += 10;
    }
    return anyGroupMatched ? total || 1 : 0;
  }

  /* ── Run search ──────────────────────────────────────────────── */
  function runSearch() {
    if (!index) { loadIndex(false); return; }

    const raw   = query.trim();
    let   q     = raw;
    let   includeContent = false;

    if (raw.toLowerCase().startsWith('content:')) {
      includeContent = true;
      q = raw.slice('content:'.length).trim();
    }


    // comma = OR groups, each group is an exact phrase
    // e.g. "react native, angular" → ["react native", "angular"]
    const groups = q.split(',').map(function (g) {
      return g.trim();
    }).filter(function (g) { return g.length > 0; });

    // flat list of all phrases for highlight
    const terms = groups.slice();

    if (!q && !activeSection) {
      showBrowse(true);
      showFilters(false);
      clearResults();
      resetChipCounts();
      return;
    }

    showBrowse(false);
    showFilters(true);

    // All term-matching results (no section filter yet)
    const allMatches = index.filter(function (page) {
      if (!groups.length) return true;
      return score(page, terms, includeContent) > 0;
    });

    // Per-section counts; non-main pages bucket into 'chapters'
    const sectionCounts = {};
    allMatches.forEach(function (page) {
      const key = isChapter(page) ? 'chapters' : page.section;
      sectionCounts[key] = (sectionCounts[key] || 0) + 1;
    });

    // Apply active filter
    let filtered;
    if (activeSection === 'chapters') {
      filtered = allMatches.filter(isChapter);
    } else if (activeSection) {
      filtered = allMatches.filter(function (p) { return p.section === activeSection; });
    } else {
      filtered = allMatches.slice();
    }

    // Sort helper
    function sortArr(arr) {
      if (groups.length) {
        return arr.map(function (p) {
          return { page: p, score: score(p, terms, includeContent) };
        }).sort(function (a, b) {
          if (activeSort === 'relevance') return b.score - a.score;
          if (activeSort === 'date-desc') return (b.page.date || '') > (a.page.date || '') ? 1 : -1;
          if (activeSort === 'date-asc')  return (a.page.date || '') > (b.page.date || '') ? 1 : -1;
          if (activeSort === 'title-asc') return (a.page.title || '').localeCompare(b.page.title || '');
          return 0;
        }).map(function (r) { return r.page; });
      }
      return arr.slice().sort(function (a, b) {
        if (activeSort === 'date-desc') return (b.date || '') > (a.date || '') ? 1 : -1;
        if (activeSort === 'date-asc')  return (a.date || '') > (b.date || '') ? 1 : -1;
        if (activeSort === 'title-asc') return (a.title || '').localeCompare(b.title || '');
        return 0;
      });
    }

    // When showing all: main section pages first, chapters appended after
    let results;
    if (!activeSection) {
      const mainR    = filtered.filter(function (p) { return !isChapter(p); });
      const chapterR = filtered.filter(isChapter);
      results = sortArr(mainR).concat(sortArr(chapterR));
    } else {
      results = sortArr(filtered);
    }

    renderResults(results, q, sectionCounts, includeContent);
  }

  /* ── Chip counts ─────────────────────────────────────────────── */
  function updateChipCounts(sectionCounts) {
    document.querySelectorAll('.filter-chip[data-filter="section"]').forEach(function (chip) {
      const sec   = chip.dataset.value;
      const count = sectionCounts[sec] || 0;
      chip.textContent = count ? sec + ' · ' + count : sec;
    });
  }

  function resetChipCounts() {
    document.querySelectorAll('.filter-chip[data-filter="section"]').forEach(function (chip) {
      chip.textContent = chip.dataset.value;
    });
  }

  /* ── Build a single result card element ─────────────────────── */
  function buildCard(page, q, includeContent) {
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
    if (includeContent) {
      excerpt.innerHTML = highlight(page.description || '', q);
    } else {
      excerpt.textContent = page.description || '';
    }

    const footer = document.createElement('div');
    footer.className = 'result-footer';
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
    return a;
  }

  /* ── Append next PAGE_SIZE cards to the wrapper ─────────────── */
  function appendNextPage() {
    const wrapper = resultsEl.querySelector('.search-results');
    if (!wrapper) return;
    // Remove sentinel before appending
    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const slice = allResults.slice(visibleCount, visibleCount + PAGE_SIZE);
    slice.forEach(function (page) {
      wrapper.appendChild(buildCard(page, currentQ, currentInclude));
    });
    visibleCount += slice.length;

    // Re-attach sentinel if there are more results
    if (visibleCount < allResults.length) {
      attachSentinel();
    } else if (scrollObserver) {
      scrollObserver.disconnect();
    }
  }

  /* ── Create & observe the scroll sentinel ────────────────────── */
  function attachSentinel() {
    const sentinel = document.createElement('div');
    sentinel.id        = 'scroll-sentinel';
    sentinel.className = 'scroll-sentinel';
    resultsEl.appendChild(sentinel);

    if (scrollObserver) scrollObserver.disconnect();
    scrollObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) appendNextPage();
    }, { rootMargin: '100px' });
    scrollObserver.observe(sentinel);
  }

  /* ── Render ──────────────────────────────────────────────────── */
  function renderResults(results, q, sectionCounts, includeContent) {
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

    // Store full result set and reset visible count
    allResults     = results;
    visibleCount   = 0;
    currentQ       = q;
    currentInclude = includeContent;
    if (scrollObserver) scrollObserver.disconnect();

    const wrapper = document.createElement('div');
    wrapper.className = 'search-results';
    resultsEl.innerHTML = '';
    resultsEl.appendChild(wrapper);

    // Render first page
    appendNextPage();
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function highlight(text, q) {
    if (!q || !text) return escHtml(text || '');
    // Highlight each phrase (comma-separated)
    const phrases = q.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
    let result  = escHtml(text);
    phrases.forEach(function (phrase) {
      if (!phrase) return;
      const re = new RegExp('(' + regEsc(escHtml(phrase)) + ')', 'gi');
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
    if (metaBar) metaBar.style.display = 'none';
    if (resultsCount) resultsCount.textContent = '';
    allResults = [];
    visibleCount = 0;
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  }

  function showBrowse(show) {
    if (browseSection) browseSection.style.display = show ? '' : 'none';
  }

  function showFilters(show) {
    if (filtersContainer) filtersContainer.style.display = show ? '' : 'none';
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

  // Section filter chips — event delegation handles dynamic chips too
  if (filtersContainer) {
    filtersContainer.addEventListener('click', function (e) {
      const chip = e.target.closest('.filter-chip[data-filter="section"]');
      if (!chip) return;
      const val = chip.dataset.value;
      if (activeSection === val) {
        activeSection = '';
        chip.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-chip[data-filter="section"]').forEach(function (c) {
          c.classList.remove('active');
        });
        activeSection = val;
        chip.classList.add('active');
      }
      runSearch();
    });
  }

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
