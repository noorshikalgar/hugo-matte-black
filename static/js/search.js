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
  const mascotEl      = document.getElementById('terminal-mascot');

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

  function removeChaptersChipIfIdle() {
    if (!filtersContainer || contentIndex || semanticIndex) return;
    var chip = filtersContainer.querySelector('[data-value="chapters"]');
    if (!chip) return;
    if (activeSection === 'chapters') activeSection = '';
    chip.remove();
  }

  /* ── State ───────────────────────────────────────────────────── */
  let index            = null;
  let contentIndex     = null;
  let semanticIndex    = null;
  let semanticEngine   = null;
  let isLoading        = false;   // guard against duplicate metadata fetches
  let isContentLoading = false;   // guard against duplicate full-text fetches
  let isSemanticLoading = false;  // guard against duplicate semantic fetches
  let query            = '';
  let activeSection    = '';   // '' = all
  let activeSort       = 'relevance';
  let loadError        = false;

  /* Infinite scroll state */
  const PAGE_SIZE       = 20;
  let   allResults      = [];   // full sorted result list for current search
  let   visibleCount    = 0;    // how many are currently rendered
  let   currentQ        = '';
  let   currentInclude  = false;
  let   scrollObserver  = null;

  const COMMANDS = {
    on: [
      'bg-video:on',
      'bgvideo:on',
      'video --on',
      'video on',
      'ambient --on'
    ],
    off: [
      'bg-video:off',
      'bgvideo:off',
      'video --off',
      'video off',
      'ambient --off'
    ]
  };

  const SEMANTIC_DIMS = 256;
  const SEMANTIC_SYNONYMS = {
    ai: ['agent', 'agents', 'llm', 'model', 'automation'],
    agent: ['ai', 'workflow', 'automation', 'assistant'],
    agents: ['ai', 'workflow', 'automation', 'assistant'],
    async: ['background', 'queue', 'job', 'worker'],
    auth: ['authentication', 'authorization', 'login', 'security'],
    background: ['async', 'queue', 'job', 'worker', 'scheduled'],
    cache: ['caching', 'memoization', 'store'],
    cloud: ['aws', 'gcp', 'azure', 'infrastructure'],
    deploy: ['deployment', 'release', 'production', 'ship'],
    durable: ['reliable', 'resilient', 'persistent', 'fault'],
    error: ['bug', 'failure', 'exception', 'debug'],
    errors: ['bugs', 'failures', 'exceptions', 'debugging'],
    gpu: ['cuda', 'graphics', 'accelerated', 'parallel'],
    jobs: ['queue', 'worker', 'background', 'tasks'],
    llm: ['ai', 'model', 'agent', 'prompt'],
    queue: ['queues', 'worker', 'job', 'background', 'async'],
    queues: ['queue', 'worker', 'job', 'background', 'async'],
    reliable: ['durable', 'resilient', 'fault', 'retry'],
    retries: ['retry', 'failure', 'durable', 'reliable'],
    retry: ['retries', 'failure', 'durable', 'reliable'],
    schedule: ['scheduled', 'cron', 'background', 'job'],
    scheduled: ['schedule', 'cron', 'background', 'job'],
    security: ['auth', 'authentication', 'authorization', 'safe'],
    test: ['testing', 'unit', 'integration', 'verify'],
    tests: ['testing', 'unit', 'integration', 'verify'],
    workflow: ['pipeline', 'orchestration', 'automation', 'agent'],
    workflows: ['pipeline', 'orchestration', 'automation', 'agent'],
    worker: ['queue', 'job', 'background', 'async']
  };

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
        removeChaptersChipIfIdle();
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

  function loadContentIndex(silent) {
    if (contentIndex || isContentLoading) {
      if (contentIndex && query) runSearch();
      return;
    }

    isContentLoading = true;
    const indexURL = (window.searchContentIndexURL) || '/content-index.json';
    if (!silent) showLoading(true);

    fetch(indexURL)
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(function (data) {
        contentIndex = data;
        isContentLoading = false;
        injectChaptersChip();
        if (!silent) showLoading(false);
        if (query || activeSection) runSearch();
      })
      .catch(function () {
        isContentLoading = false;
        if (!silent) showLoading(false);
        if (!silent) showError('Could not load full-text search index.');
      });
  }

  function loadSemanticIndex(silent) {
    if (semanticIndex || isSemanticLoading) {
      if (semanticIndex && query) runSearch();
      return;
    }

    isSemanticLoading = true;
    const indexURL = (window.searchSemanticIndexURL) || '/semantic-index.json';
    if (!silent) showLoading(true, 'loading semantic index...');

    fetch(indexURL)
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(function (data) {
        semanticIndex = data;
        semanticEngine = buildSemanticEngine(data);
        isSemanticLoading = false;
        injectChaptersChip();
        if (!silent) showLoading(false);
        if (query || activeSection) runSearch();
      })
      .catch(function () {
        isSemanticLoading = false;
        if (!silent) showLoading(false);
        if (!silent) showError('Could not load semantic search index.');
      });
  }

  /* ── Scoring ─────────────────────────────────────────────────── */

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'how', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'the', 'to',
    'vs', 'with', 'your'
  ]);

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function tokenize(value) {
    return normalizeText(value)
      .split(/[^a-z0-9+#.]+/i)
      .map(function (token) { return token.trim(); })
      .filter(function (token) {
        return token.length > 1 && !STOP_WORDS.has(token);
      });
  }

  function stemToken(token) {
    if (!token || token.length < 4) return token;
    return token
      .replace(/(?:ization|isation)$/i, 'ize')
      .replace(/(?:ing|ers|ies|ied|ed|es|s)$/i, function (suffix) {
        if (suffix === 'ies' || suffix === 'ied') return 'y';
        return '';
      });
  }

  function semanticTokens(value) {
    var base = tokenize(value).map(stemToken).filter(Boolean);
    var expanded = [];
    base.forEach(function (token) {
      expanded.push(token);
      var synonyms = SEMANTIC_SYNONYMS[token];
      if (synonyms) {
        synonyms.forEach(function (synonym) {
          expanded.push(stemToken(synonym));
        });
      }
    });
    return expanded;
  }

  function hashToken(token) {
    var hash = 2166136261;
    for (var i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0) % SEMANTIC_DIMS;
  }

  function addVectorValue(vector, key, value) {
    vector[key] = (vector[key] || 0) + value;
  }

  function normalizeVector(vector) {
    var sum = 0;
    Object.keys(vector).forEach(function (key) {
      sum += vector[key] * vector[key];
    });
    if (!sum) return vector;
    var length = Math.sqrt(sum);
    Object.keys(vector).forEach(function (key) {
      vector[key] = vector[key] / length;
    });
    return vector;
  }

  function vectorizeText(value, idf) {
    var vector = {};
    semanticTokens(value).forEach(function (token) {
      var key = hashToken(token);
      addVectorValue(vector, key, idf && idf[token] ? idf[token] : 1);
    });
    return normalizeVector(vector);
  }

  function cosineSimilarity(a, b) {
    var score = 0;
    var small = Object.keys(a).length < Object.keys(b).length ? a : b;
    var large = small === a ? b : a;
    Object.keys(small).forEach(function (key) {
      if (large[key]) score += small[key] * large[key];
    });
    return score;
  }

  function buildSemanticEngine(pages) {
    var docs = pages.map(function (page) {
      var text = [
        page.title,
        page.description,
        Array.isArray(page.tags) ? page.tags.join(' ') : '',
        Array.isArray(page.categories) ? page.categories.join(' ') : '',
        page.topic,
        page.difficulty,
        page.contentType,
        page.content
      ].join(' ');
      return {
        page: page,
        text: text,
        tokens: Array.from(new Set(semanticTokens(text)))
      };
    });

    var df = {};
    docs.forEach(function (doc) {
      doc.tokens.forEach(function (token) {
        df[token] = (df[token] || 0) + 1;
      });
    });

    var count = Math.max(1, docs.length);
    var idf = {};
    Object.keys(df).forEach(function (token) {
      idf[token] = Math.log(1 + (count / (1 + df[token]))) + 1;
    });

    docs.forEach(function (doc) {
      doc.vector = vectorizeText(doc.text, idf);
    });

    return { docs: docs, idf: idf };
  }

  function semanticScore(page, q) {
    var base = scoreGroup(page, q, true);
    return base ? Math.min(0.2, base / 1000) : 0;
  }

  function runSemanticSearch(q) {
    if (!semanticIndex || !semanticEngine) {
      loadSemanticIndex(false);
      return;
    }

    var queryVector = vectorizeText(q, semanticEngine.idf);
    var allMatches = semanticEngine.docs.map(function (doc) {
      var semantic = cosineSimilarity(queryVector, doc.vector);
      var lexical = semanticScore(doc.page, q);
      var recency = recentBoost(doc.page) / 500;
      return {
        page: doc.page,
        score: semantic + lexical + recency
      };
    }).filter(function (item) {
      return item.score > 0.08;
    });

    const sectionCounts = {};
    allMatches.forEach(function (item) {
      const key = isChapter(item.page) ? 'chapters' : item.page.section;
      sectionCounts[key] = (sectionCounts[key] || 0) + 1;
    });

    let filtered;
    if (activeSection === 'chapters') {
      filtered = allMatches.filter(function (item) { return isChapter(item.page); });
    } else if (activeSection) {
      filtered = allMatches.filter(function (item) { return item.page.section === activeSection; });
    } else {
      filtered = allMatches.slice();
    }

    filtered.sort(function (a, b) {
      if (activeSort === 'date-desc') return (b.page.date || '') > (a.page.date || '') ? 1 : -1;
      if (activeSort === 'date-asc')  return (a.page.date || '') > (b.page.date || '') ? 1 : -1;
      if (activeSort === 'title-asc') return (a.page.title || '').localeCompare(b.page.title || '');
      return b.score - a.score;
    });

    renderResults(filtered.map(function (item) { return item.page; }), q, sectionCounts, true, 'AI');
  }

  function hasWord(text, token) {
    if (!text || !token) return false;
    return text.indexOf(token) !== -1;
  }

  function getSearchFields(page, includeContent) {
    var cached = page._searchFields;
    if (cached && cached.includeContent === includeContent) return cached;

    var tags = Array.isArray(page.tags) ? page.tags.join(' ') : '';
    var categories = Array.isArray(page.categories) ? page.categories.join(' ') : '';
    var title = normalizeText(page.title);
    var description = normalizeText(page.description);
    var tagText = normalizeText(tags);
    var categoryText = normalizeText(categories);
    var section = normalizeText(page.section);
    var topic = normalizeText(page.topic);
    var difficulty = normalizeText(page.difficulty);
    var contentType = normalizeText(page.contentType);
    var content = includeContent ? normalizeText(page.content) : '';

    cached = {
      includeContent: includeContent,
      title: title,
      description: description,
      tags: tagText,
      categories: categoryText,
      section: section,
      topic: topic,
      difficulty: difficulty,
      contentType: contentType,
      content: content,
      allMetadata: [
        title,
        description,
        tagText,
        categoryText,
        section,
        topic,
        difficulty,
        contentType
      ].join(' '),
      all: [
        title,
        description,
        tagText,
        categoryText,
        section,
        topic,
        difficulty,
        contentType,
        content
      ].join(' ')
    };
    page._searchFields = cached;
    return cached;
  }

  function recentBoost(page) {
    if (!page.date) return 0;
    var timestamp = Date.parse(page.date + 'T00:00:00Z');
    if (!isFinite(timestamp)) return 0;
    var ageDays = (Date.now() - timestamp) / 86400000;
    if (ageDays < 0) return 8;
    if (ageDays > 180) return 0;
    return Math.max(0, Math.round(14 - ageDays / 15));
  }

  function scoreFieldToken(text, token, exactWeight, containsWeight, prefixWeight) {
    if (!text || !token || text.indexOf(token) === -1) return 0;
    if (text === token) return exactWeight;
    if (text.indexOf(token) === 0) return prefixWeight || containsWeight;
    return containsWeight;
  }

  function scoreGroup(page, phrase, includeContent) {
    var fields = getSearchFields(page, includeContent);
    var normalizedPhrase = normalizeText(phrase).trim();
    var tokens = tokenize(phrase);
    var phraseScore = 0;
    var tokenScore = 0;

    if (!tokens.length && !normalizedPhrase) return 0;

    if (normalizedPhrase.length > 1) {
      if (fields.title.indexOf(normalizedPhrase) === 0) phraseScore += 220;
      else if (fields.title.indexOf(normalizedPhrase) !== -1) phraseScore += 160;
      if (fields.tags.indexOf(normalizedPhrase) !== -1) phraseScore += 130;
      if (fields.topic.indexOf(normalizedPhrase) !== -1) phraseScore += 90;
      if (fields.contentType.indexOf(normalizedPhrase) !== -1) phraseScore += 75;
      if (fields.description.indexOf(normalizedPhrase) !== -1) phraseScore += 60;
      if (fields.section.indexOf(normalizedPhrase) !== -1) phraseScore += 35;
      if (includeContent && fields.content.indexOf(normalizedPhrase) !== -1) phraseScore += 24;
    }

    var matchedTokens = 0;
    tokens.forEach(function (token) {
      var tokenMatched = hasWord(fields.all, token);
      if (!tokenMatched) return;
      matchedTokens += 1;

      tokenScore += scoreFieldToken(fields.title, token, 75, 42, 62);
      tokenScore += scoreFieldToken(fields.tags, token, 70, 46, 56);
      tokenScore += scoreFieldToken(fields.topic, token, 44, 30, 38);
      tokenScore += scoreFieldToken(fields.contentType, token, 38, 24, 30);
      tokenScore += scoreFieldToken(fields.categories, token, 34, 20, 26);
      tokenScore += scoreFieldToken(fields.description, token, 26, 14, 20);
      tokenScore += scoreFieldToken(fields.section, token, 20, 10, 14);
      if (includeContent) tokenScore += scoreFieldToken(fields.content, token, 10, 4, 6);
    });

    var allTokensMatched = tokens.length > 0 && matchedTokens === tokens.length;
    if (!phraseScore && !allTokensMatched) return 0;

    var total = phraseScore + tokenScore;
    if (allTokensMatched && tokens.length > 1) total += 35 + (tokens.length * 6);
    if (page.featured) total += 35;
    total += recentBoost(page);

    if (isChapter(page)) {
      total *= includeContent ? 0.88 : 0.78;
    }

    return Math.round(total);
  }

  /**
   * Score a page against OR-groups.
   * groups = ["react native", "angular"] -> page matches if ANY group matches.
   * Multi-word groups require all meaningful words unless an exact phrase matches.
   */
  function score(page, groups, includeContent) {
    var best = 0;
    groups.forEach(function (phrase) {
      best = Math.max(best, scoreGroup(page, phrase, includeContent));
    });
    return best;
  }

  /* ── Run search ──────────────────────────────────────────────── */
  function runSearch() {
    if (!index) { loadIndex(false); return; }

    const raw   = query.trim();
    let   q     = raw;
    let   includeContent = false;
    let   includeSemantic = false;

    if (raw.toLowerCase().startsWith('content:')) {
      includeContent = true;
      q = raw.slice('content:'.length).trim();
    } else if (raw.toLowerCase().startsWith('ai:')) {
      includeSemantic = true;
      q = raw.slice('ai:'.length).trim();
    } else if (raw.toLowerCase().startsWith('semantic:')) {
      includeSemantic = true;
      q = raw.slice('semantic:'.length).trim();
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

    if (includeContent && groups.length && !contentIndex) {
      loadContentIndex(false);
      return;
    }

    if (includeSemantic && groups.length) {
      showBrowse(false);
      showFilters(true);
      runSemanticSearch(q);
      return;
    }

    showBrowse(false);
    showFilters(true);
    if (includeContent) injectChaptersChip();
    else removeChaptersChipIfIdle();

    const searchIndex = includeContent && contentIndex ? contentIndex : index;

    // All term-matching results (no section filter yet)
    const allMatches = searchIndex.filter(function (page) {
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

    let results = sortArr(filtered);

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
    excerpt.innerHTML = highlight(makeExcerpt(page, q, includeContent), q);

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
  function renderResults(results, q, sectionCounts, includeContent, modeLabel) {
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
          (q ? ' for "' + escHtml(q) + '"' : '') +
          (modeLabel ? ' · ' + escHtml(modeLabel) : '');
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
    const phrases = [];
    q.split(',').forEach(function (group) {
      var phrase = group.trim();
      if (phrase) phrases.push(phrase);
      tokenize(phrase).forEach(function (token) {
        if (phrases.indexOf(token) === -1) phrases.push(token);
      });
    });

    let result  = escHtml(text);
    phrases.sort(function (a, b) { return b.length - a.length; }).forEach(function (phrase) {
      if (!phrase) return;
      const re = new RegExp('(' + regEsc(escHtml(phrase)) + ')', 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  function makeExcerpt(page, q, includeContent) {
    var fallback = page.description || '';
    if (!includeContent || !page.content) return fallback;

    var terms = [];
    q.split(',').forEach(function (group) {
      terms = terms.concat(tokenize(group));
      var phrase = normalizeText(group).trim();
      if (phrase.length > 2) terms.unshift(phrase);
    });

    var content = page.content || '';
    var normalizedContent = normalizeText(content);
    var bestIndex = -1;
    terms.some(function (term) {
      bestIndex = normalizedContent.indexOf(term);
      return bestIndex !== -1;
    });

    if (bestIndex === -1) return fallback || content.slice(0, 220);

    var radius = 120;
    var start = Math.max(0, bestIndex - radius);
    var end = Math.min(content.length, bestIndex + radius);
    var excerpt = content.slice(start, end).replace(/\s+/g, ' ').trim();

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt += '...';
    return excerpt;
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

  function showLoading(show, message) {
    if (loadingEl) loadingEl.style.display = show ? '' : 'none';
    if (loadingEl && message) loadingEl.textContent = message;
    if (loadingEl && !show) loadingEl.textContent = 'loading index...';
  }

  function showError(msg) {
    if (resultsEl) resultsEl.innerHTML =
      '<div class="search-empty"><span class="empty-icon">!</span>' + msg + '</div>';
  }

  function restoreBrowseState() {
    query = '';
    activeSection = '';
    clearResults();
    resetChipCounts();
    showBrowse(true);
    showFilters(false);
    if (loadingEl) loadingEl.style.display = 'none';
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.filter-chip[data-filter="section"]').forEach(function (chip) {
      chip.classList.remove('active');
    });
  }

  function parseCommand(raw) {
    var normalized = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return null;
    if (COMMANDS.on.indexOf(normalized) !== -1) return { type: 'ambient-video', enabled: true };
    if (COMMANDS.off.indexOf(normalized) !== -1) return { type: 'ambient-video', enabled: false };
    return null;
  }

  function dispatchAmbientVideoCommand(enabled) {
    window.dispatchEvent(new CustomEvent('ambient-video-toggle', {
      detail: { enabled: enabled }
    }));
  }

  function handleSearchCommand(raw) {
    var command = parseCommand(raw);
    if (!command) return false;

    if (command.type === 'ambient-video') {
      dispatchAmbientVideoCommand(command.enabled);
      syncUrl('');
      restoreBrowseState();
      return true;
    }

    return false;
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

  function syncUrl(q) {
    const url = new URL(window.location);
    if (q) { url.searchParams.set('q', q); }
    else    { url.searchParams.delete('q'); }
    history.replaceState(null, '', url);
  }

  searchInput.addEventListener('input', function () {
    query = this.value;
    if (handleSearchCommand(query)) return;
    syncUrl(query);
    debouncedSearch();
  });

  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      query = searchInput.value;
      if (handleSearchCommand(query)) return;
      syncUrl(query);
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
  (function initMascot() {
    if (!mascotEl || window.matchMedia('(max-width: 980px)').matches) return;

    var mascotSize = 128;
    var footerEl = mascotEl.closest('.site-footer');
    var hoverLock = false;
    var actionLock = false;
    var seekTimer = null;
    var actionTimer = null;
    var currentX = 0;
    var ACTIONS = [
      { name: 'action-bounce', thought: 'hi' },
      { name: 'action-wink', thought: ':)' },
      { name: 'action-tilt', thought: 'hmm' },
      { name: 'action-glitch', thought: '...' }
    ];

    function clearMascotState() {
      mascotEl.classList.remove(
        'is-awake',
        'is-hiding',
        'is-seeking',
        'action-bounce',
        'action-wink',
        'action-tilt',
        'action-glitch'
      );
    }

    function setThought(text) {
      mascotEl.dataset.thought = text || '';
      mascotEl.classList.toggle('has-thought', !!text);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function positionMascot(opts) {
      var options = opts || {};
      var footerWidth = footerEl ? footerEl.clientWidth : window.innerWidth;
      var marginX = 24;
      var maxX = Math.max(marginX, footerWidth - mascotSize - marginX);
      var x = maxX;

      if (!options.bottomRight) {
        var candidate = currentX || maxX;
        var attempts = 0;
        while (attempts < 8 && Math.abs(candidate - currentX) < 120) {
          candidate = marginX + Math.random() * Math.max(1, maxX - marginX);
          attempts += 1;
        }
        x = candidate;
      }

      currentX = clamp(x, marginX, maxX);
      mascotEl.style.setProperty('--mascot-x', currentX + 'px');
    }

    function scheduleSeek() {
      clearTimeout(seekTimer);
      seekTimer = setTimeout(function () {
        if (hoverLock || actionLock || document.hidden) {
          scheduleSeek();
          return;
        }

        actionLock = true;
        clearMascotState();
        mascotEl.classList.add('is-hiding');
        setThought('shh');

        setTimeout(function () {
          positionMascot();
        }, 700);

        setTimeout(function () {
          clearMascotState();
          mascotEl.classList.add('is-seeking');
          setThought('psst');

          setTimeout(function () {
            clearMascotState();
            setThought('');
            actionLock = false;
            scheduleSeek();
          }, 1000);
        }, 1600);
      }, 12000 + Math.random() * 9000);
    }

    positionMascot({ bottomRight: true });
    setThought('');

    mascotEl.addEventListener('mouseenter', function () {
      hoverLock = true;
      clearMascotState();
      mascotEl.classList.add('is-awake');
      setThought('oh?');
      clearTimeout(seekTimer);
    });

    mascotEl.addEventListener('mouseleave', function () {
      hoverLock = false;
      clearTimeout(actionTimer);
      if (!actionLock) {
        clearMascotState();
        setThought('');
      }
      scheduleSeek();
    });

    mascotEl.addEventListener('click', function () {
      actionLock = true;
      clearMascotState();
      clearTimeout(seekTimer);
      clearTimeout(actionTimer);

      var choice = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      mascotEl.classList.add(choice.name);
      setThought(choice.thought);

      actionTimer = setTimeout(function () {
        actionLock = false;
        if (hoverLock) {
          clearMascotState();
          mascotEl.classList.add('is-awake');
          setThought('heh');
        } else {
          clearMascotState();
          setThought('');
          scheduleSeek();
        }
      }, 850);
    });

    window.addEventListener('resize', function () {
      positionMascot({ bottomRight: currentX === 0 });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearTimeout(seekTimer);
      } else if (!hoverLock && !actionLock) {
        scheduleSeek();
      }
    });

    scheduleSeek();
  }());

  // Pre-load index silently in background (consumes preload hint)
  loadIndex(true);

  // Handle URL query param ?q=...
  const urlParams = new URLSearchParams(window.location.search);
  const urlQ      = urlParams.get('q');
  if (urlQ) {
    searchInput.value = urlQ;
    query = urlQ;
    runSearch();
  }

})();
