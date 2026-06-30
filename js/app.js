const searchInput = document.getElementById('search');
const authorFilter = document.getElementById('authorFilter');
const tagFilter = document.getElementById('tagFilter');
const quotesGrid = document.getElementById('quotesGrid');
const emptyState = document.getElementById('emptyState');

let quotes = [];
let resizeTimer;
let quoteId = 0;

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getTags(quote) {
  return Array.isArray(quote.tags) ? quote.tags : [];
}

function sanitizeQuote(quote) {
  if (!quote || typeof quote !== 'object') {
    return null;
  }

  const text = String(quote.text ?? '').trim();

  if (!text) {
    return null;
  }

  return {
    text,
    author: String(quote.author ?? 'Unknown').trim() || 'Unknown',
    source: String(quote.source ?? '').trim(),
    page: String(quote.page ?? '').trim(),
    imageUrl: String(quote.imageUrl ?? '').trim(),
    tags: getTags(quote)
      .map((tag) => String(tag ?? '').trim())
      .filter(Boolean),
  };
}

function escapeHtml(value) {
  const temp = document.createElement('span');
  temp.textContent = String(value ?? '');
  return temp.innerHTML;
}

// Detect and highlight scripture references.
// Pattern matches: Book Chapter:Verse(s) or Book Chapter.Verse or abbreviated patterns
// Examples: "Psalm 118:94", "Matth. xi. 2", "John 3:16", "1 Corinthians 13:4-7"
const scripturePattern = /\b([A-Z][a-z]*\.?\s+(?:\d+|[ivxlcdm]+)[.:]\s*(?:\d+(?:[–-]\d+)?|[ivxlcdm]+)?(?:\s*[–-]\s*\d+)?)\b/gi;

function highlightScriptureRefs(text) {
  return escapeHtml(text).replace(scripturePattern, (match) => {
    return `<span class="scripture-ref">${match}</span>`;
  });
}

function formatQuoteText(text) {
  const escapedWithAllowedEmphasis = escapeHtml(text)
    .replace(/&lt;\s*em\s*&gt;/gi, '<em>')
    .replace(/&lt;\s*\/\s*em\s*&gt;/gi, '</em>');

  return escapedWithAllowedEmphasis.replace(scripturePattern, (match) => {
    return `<span class="scripture-ref">${match}</span>`;
  });
}

function matchesSearch(quote, query) {
  if (!query) {
    return true;
  }

  const fields = [quote.text, quote.author, quote.source, ...getTags(quote)];
  return fields.some((field) => normalize(field).includes(query));
}

function matchesSelect(value, filterValue) {
  return !filterValue || normalize(value) === normalize(filterValue);
}

function renderOptions(items, element) {
  const sorted = [...items].sort((a, b) => a.localeCompare(b));
  sorted.forEach((item) => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    element.appendChild(option);
  });
}

function createQuoteCard(quote) {
  const card = document.createElement('article');
  card.className = 'quote-card';

  const quoteMain = document.createElement('div');
  quoteMain.className = 'quote-main';

  // Add image as a small circular avatar if available. Values may be
  // repo-local paths such as "images/augustine.svg" or remote URLs.
  if (quote.imageUrl) {
    const img = document.createElement('img');
    img.src = quote.imageUrl;
    img.alt = quote.author ? `Portrait of ${quote.author}` : 'Quote image';
    img.className = 'quote-avatar';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.remove();
    };
    quoteMain.appendChild(img);
  }

  const quoteContent = document.createElement('div');
  quoteContent.className = 'quote-content';

  const text = document.createElement('p');
  text.className = 'quote-text quote-text--clamped';
  quoteId += 1;
  text.id = `quote-${quoteId}`;
  // Escape quote text first, then allow only simple <em> tags for italic emphasis.
  text.innerHTML = formatQuoteText(quote.text);
  quoteContent.appendChild(text);

  const toggle = document.createElement('button');
  toggle.className = 'quote-toggle';
  toggle.type = 'button';
  toggle.textContent = '…';
  toggle.setAttribute('aria-label', 'Show full quote');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', text.id);
  toggle.hidden = true;
  quoteContent.appendChild(toggle);

  quoteMain.appendChild(quoteContent);

  card.appendChild(quoteMain);
  const meta = document.createElement('div');
  meta.className = 'quote-meta';

  const author = document.createElement('span');
  author.className = 'author';
  // Use innerHTML only after escaping the author field, so references can still be highlighted safely.
  author.innerHTML = highlightScriptureRefs(quote.author);
  meta.appendChild(author);

  if (quote.source) {
    const source = document.createElement('span');
    source.className = 'source';
    source.textContent = quote.source;
    meta.appendChild(source);
  }

  if (quote.page) {
    const page = document.createElement('span');
    page.className = 'page-number';
    page.textContent = `p. ${quote.page}`;
    meta.appendChild(page);
  }

  card.appendChild(meta);

  const tags = getTags(quote);
  if (tags.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'tags';
    tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = tag;
      tagRow.appendChild(chip);
    });
    card.appendChild(tagRow);
  }

  return card;
}

function isQuoteOverflowing(text) {
  const wasClamped = text.classList.contains('quote-text--clamped');
  const previousWebkitLineClamp = text.style.webkitLineClamp;

  text.classList.remove('quote-text--clamped');
  text.style.webkitLineClamp = 'none';
  const fullHeight = text.scrollHeight;

  text.classList.add('quote-text--clamped');
  text.style.webkitLineClamp = '4';
  const clampedHeight = text.getBoundingClientRect().height;

  text.style.webkitLineClamp = previousWebkitLineClamp;
  text.classList.toggle('quote-text--clamped', wasClamped);

  return fullHeight - clampedHeight > 1;
}

function setupExpandableQuotes() {
  quotesGrid.querySelectorAll('.quote-content').forEach((content) => {
    const text = content.querySelector('.quote-text');
    const toggle = content.querySelector('.quote-toggle');

    if (!text || !toggle) {
      return;
    }

    const isExpanded = content.classList.contains('quote-content--expanded');
    const hasOverflow = isQuoteOverflowing(text);

    toggle.hidden = !hasOverflow;
    content.classList.toggle('quote-content--expandable', hasOverflow);

    if (!hasOverflow) {
      content.classList.remove('quote-content--expanded');
      text.classList.remove('quote-text--clamped');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '…';
      toggle.setAttribute('aria-label', 'Show full quote');
      return;
    }

    content.classList.toggle('quote-content--expanded', isExpanded);
    text.classList.toggle('quote-text--clamped', !isExpanded);
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.textContent = isExpanded ? '–' : '…';
    toggle.setAttribute('aria-label', isExpanded ? 'Show less quote text' : 'Show full quote');
  });
}

function renderQuotes() {
  const query = normalize(searchInput.value);
  const author = authorFilter.value;
  const tag = tagFilter.value;

  quotesGrid.innerHTML = '';

  const filtered = quotes.filter((quote) => {
    const tags = getTags(quote);

    return (
      matchesSearch(quote, query) &&
      matchesSelect(quote.author, author) &&
      (!tag || tags.some((item) => normalize(item) === normalize(tag)))
    );
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  filtered.forEach((quote) => {
    quotesGrid.appendChild(createQuoteCard(quote));
  });

  requestAnimationFrame(setupExpandableQuotes);
}

function initFilters(data) {
  const authorSet = new Set();
  const tagSet = new Set();

  data.forEach((quote) => {
    if (quote.author) {
      authorSet.add(quote.author);
    }
    getTags(quote).forEach((tag) => tagSet.add(tag));
  });

  renderOptions(authorSet, authorFilter);
  renderOptions(tagSet, tagFilter);
}

function toggleQuoteExpansion(event) {
  const toggle = event.target.closest('.quote-toggle');

  if (!toggle) {
    return;
  }

  const content = toggle.closest('.quote-content');
  const text = content?.querySelector('.quote-text');

  if (!content || !text) {
    return;
  }

  const isExpanded = !content.classList.contains('quote-content--expanded');
  content.classList.toggle('quote-content--expanded', isExpanded);
  text.classList.toggle('quote-text--clamped', !isExpanded);
  toggle.setAttribute('aria-expanded', String(isExpanded));
  toggle.textContent = isExpanded ? '–' : '…';
  toggle.setAttribute('aria-label', isExpanded ? 'Show less quote text' : 'Show full quote');
}

function handleResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(setupExpandableQuotes, 150);
}

function setupEvents() {
  searchInput.addEventListener('input', renderQuotes);
  authorFilter.addEventListener('change', renderQuotes);
  tagFilter.addEventListener('change', renderQuotes);
  quotesGrid.addEventListener('click', toggleQuoteExpansion);
  window.addEventListener('resize', handleResize);
}


function loadQuotes() {
  fetch('quotes.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Unable to load quotes.');
      }
      return response.json();
    })
    .then((data) => {
      quotes = (Array.isArray(data) ? data : [])
        .map(sanitizeQuote)
        .filter(Boolean);
      initFilters(quotes);
      renderQuotes();
    })
    .catch((error) => {
      quotesGrid.innerHTML = '<p class="empty-state">Unable to load quotes at this time.</p>';
      console.error(error);
    });
}

window.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadQuotes();
});
