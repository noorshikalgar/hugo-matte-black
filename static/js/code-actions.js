/**
 * code-actions.js — Code block copy buttons and expanded viewer.
 */

(function () {
  'use strict';

  var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 8V7C10 6.05719 10 5.58579 10.2929 5.29289C10.5858 5 11.0572 5 12 5H17C17.9428 5 18.4142 5 18.7071 5.29289C19 5.58579 19 6.05719 19 7V12C19 12.9428 19 13.4142 18.7071 13.7071C18.4142 14 17.9428 14 17 14H16M7 19H12C12.9428 19 13.4142 19 13.7071 18.7071C14 18.4142 14 17.9428 14 17V12C14 11.0572 14 10.5858 13.7071 10.2929C13.4142 10 12.9428 10 12 10H7C6.05719 10 5.58579 10 5.29289 10.2929C5 10.5858 5 11.0572 5 12V17C5 17.9428 5 18.4142 5.29289 18.7071C5.58579 19 6.05719 19 7 19Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var COPY_OK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var COPY_FAIL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  function copyCodeText(text, button) {
    return navigator.clipboard.writeText(text).then(function () {
      if (!button) return;
      var original = button.getAttribute('data-original-html') || button.innerHTML;
      var isIconButton = button.getAttribute('data-icon-button') === 'true';
      button.setAttribute('data-original-html', original);
      button.innerHTML = isIconButton ? COPY_OK_ICON : 'copied!';
      button.classList.add('copied');
      setTimeout(function () {
        button.innerHTML = original;
        button.classList.remove('copied');
      }, 2000);
    }).catch(function () {
      if (!button) return;
      var original = button.getAttribute('data-original-html') || button.innerHTML;
      var isIconButton = button.getAttribute('data-icon-button') === 'true';
      button.setAttribute('data-original-html', original);
      button.innerHTML = isIconButton ? COPY_FAIL_ICON : 'failed';
      setTimeout(function () { button.innerHTML = original; }, 1500);
    });
  }

  function getCodeLanguage(code, pre) {
    var lang = pre.getAttribute('data-lang') || code.getAttribute('data-lang') || '';
    var className = code.className || pre.className || '';
    var match = className.match(/(?:language|lang)-([a-z0-9_+#.-]+)/i);

    if (!lang && match) lang = match[1];
    if (!lang) lang = 'code';
    return lang.replace(/^text$/i, 'code').toUpperCase();
  }

  function closeCodeModal() {
    var modal = document.getElementById('code-viewer-modal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.classList.remove('code-viewer-open');
  }

  function ensureCodeModal() {
    var existing = document.getElementById('code-viewer-modal');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.id = 'code-viewer-modal';
    modal.className = 'code-viewer-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'code-viewer-language');
    modal.setAttribute('hidden', '');
    modal.innerHTML =
      '<div class="code-viewer-backdrop" data-code-viewer-close></div>' +
      '<section class="code-viewer-panel">' +
        '<header class="code-viewer-header">' +
          '<span class="code-viewer-language" id="code-viewer-language">CODE</span>' +
          '<div class="code-viewer-actions">' +
            '<button type="button" class="code-viewer-copy" data-label="copy" data-icon-button="true" aria-label="Copy code" title="Copy code">' + COPY_ICON + '</button>' +
            '<button type="button" class="code-viewer-close" aria-label="Close code viewer" title="Close" data-code-viewer-close>' + CLOSE_ICON + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="code-viewer-body">' +
          '<div class="code-viewer-code chroma" role="region" aria-label="Code preview"></div>' +
        '</div>' +
      '</section>';

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-code-viewer-close]').forEach(function (btn) {
      btn.addEventListener('click', closeCodeModal);
    });

    modal.querySelector('.code-viewer-copy').addEventListener('click', function () {
      copyCodeText(modal.getAttribute('data-code-text') || '', this);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeCodeModal();
    });

    return modal;
  }

  function codeHtmlToNumberedLines(code) {
    var raw = code.textContent || '';
    var chromaLines = code.querySelectorAll('.line');
    var rawLines = raw.replace(/\n$/, '').split('\n');
    var htmlLines = chromaLines.length
      ? Array.prototype.map.call(chromaLines, function (line) { return line.innerHTML || ' '; })
      : (code.innerHTML || '').replace(/\n$/, '').split('\n');
    var lineCount = Math.max(htmlLines.length, rawLines.length, 1);
    var out = '';

    for (var i = 0; i < lineCount; i += 1) {
      var lineHtml = htmlLines[i] || '';
      out += '<div class="code-viewer-line">' +
        '<span class="code-viewer-gutter">' + (i + 1) + '</span>' +
        '<span class="code-viewer-line-content">' + (lineHtml || ' ') + '</span>' +
      '</div>';
    }

    return { html: out, lineCount: lineCount, raw: raw };
  }

  function openCodeModal(code, language) {
    var modal = ensureCodeModal();
    var codeTarget = modal.querySelector('.code-viewer-code');
    var langTarget = modal.querySelector('.code-viewer-language');
    var codeData = codeHtmlToNumberedLines(code);

    codeTarget.innerHTML = codeData.html;
    modal.setAttribute('data-code-text', codeData.raw);
    modal.style.setProperty('--code-viewer-lines', String(codeData.lineCount));
    modal.classList.toggle('is-compact', codeData.lineCount <= 12);
    langTarget.textContent = language;
    modal.removeAttribute('hidden');
    document.body.classList.add('code-viewer-open');
    modal.querySelector('.code-viewer-close').focus();
  }

  function addCodeBlockActions() {
    document.querySelectorAll('pre code').forEach(function (code) {
      const pre = code.parentNode;
      const highlight = pre.closest('.highlight');
      let mount;

      if (highlight) {
        mount = highlight;
      } else {
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

      if (mount.querySelector('.copy-button') && mount.querySelector('.expand-code-button')) return;

      var language = getCodeLanguage(code, pre);

      if (!mount.querySelector('.copy-button')) {
        const btn = document.createElement('button');
        btn.className = 'copy-button code-action-button';
        btn.innerHTML = COPY_ICON;
        btn.setAttribute('data-label', 'copy');
        btn.setAttribute('data-icon-button', 'true');
        btn.setAttribute('data-original-html', btn.innerHTML);
        btn.setAttribute('aria-label', 'Copy code');
        btn.title = 'Copy code';

        btn.addEventListener('click', function () {
          copyCodeText(code.textContent, btn);
        });

        mount.appendChild(btn);
      }

      if (!mount.querySelector('.expand-code-button')) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-code-button code-action-button';
        expandBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        expandBtn.title = 'Open code viewer';
        expandBtn.setAttribute('aria-label', 'Open code viewer');
        expandBtn.addEventListener('click', function () {
          openCodeModal(code, language);
        });

        mount.appendChild(expandBtn);
      }
    });
  }

  addCodeBlockActions();
})();
