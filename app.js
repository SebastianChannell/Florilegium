const searchInput = document.getElementById('search');
const authorFilter = document.getElementById('authorFilter');
const tagFilter = document.getElementById('tagFilter');
const quotesGrid = document.getElementById('quotesGrid');
const emptyState = document.getElementById('emptyState');

let quotes = [];

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function matchesSearch(quote, query) {
  if (!query) {
    return true;
  }

  const fields = [quote.text, quote.author, quote.source, ...(quote.tags || [])];
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

// Detect and highlight scripture references
function highlightScriptureRefs(text) {
  // Pattern matches: Book Chapter:Verse(s) or Book Chapter.Verse or abbreviated patterns
  // Examples: "Psalm 118:94", "Matth. xi. 2", "John 3:16", "1 Corinthians 13:4-7"
  const scripturePattern = /\b([A-Z][a-z]*\.?\s+(?:\d+|[ivxlcdm]+)[.:]\s*(?:\d+(?:[–-]\d+)?|[ivxlcdm]+)?(?:\s*[–-]\s*\d+)?)\b/gi;
  
  return text.replace(scripturePattern, (match) => {
    return `<span class="scripture-ref">${match}</span>`;
  });
}

function createQuoteCard(quote) {
  const card = document.createElement('article');
  card.className = 'quote-card';

  const quoteMain = document.createElement('div');
  quoteMain.className = 'quote-main';

  // Add image as a small circular avatar if available. Values may be
  // repo-local paths such as "images/augustine.svg" or remote URLs.
  if (typeof quote.imageUrl === 'string' && quote.imageUrl.trim()) {
    const img = document.createElement('img');
    img.src = quote.imageUrl.trim();
    img.alt = quote.author ? `Portrait of ${quote.author}` : 'Quote image';
    img.className = 'quote-avatar';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.remove();
    };
    quoteMain.appendChild(img);
  }

  const text = document.createElement('p');
  text.className = 'quote-text';
  // Use innerHTML to render the highlighted scripture references
  text.innerHTML = highlightScriptureRefs(quote.text);
  quoteMain.appendChild(text);

  card.appendChild(quoteMain);
  const meta = document.createElement('div');
  meta.className = 'quote-meta';

  const author = document.createElement('span');
  author.className = 'author';
  // Use innerHTML to render highlighted scripture references in author field
  author.innerHTML = highlightScriptureRefs(quote.author);
  meta.appendChild(author);

  const source = document.createElement('span');
  source.className = 'source';
  source.textContent = quote.source;
  meta.appendChild(source);

  if (quote.page) {
    const page = document.createElement('span');
    page.className = 'page-number';
    page.textContent = `p. ${quote.page}`;
    meta.appendChild(page);
  }

  card.appendChild(meta);

  if (quote.tags && quote.tags.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'tags';
    quote.tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = tag;
      tagRow.appendChild(chip);
    });
    card.appendChild(tagRow);
  }

  return card;
}

function renderQuotes() {
  const query = normalize(searchInput.value);
  const author = authorFilter.value;
  const tag = tagFilter.value;

  quotesGrid.innerHTML = '';

  const filtered = quotes.filter((quote) => {
    return (
      matchesSearch(quote, query) &&
      matchesSelect(quote.author, author) &&
      (!tag || quote.tags.some((item) => normalize(item) === normalize(tag)))
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
}

function initFilters(data) {
  const authorSet = new Set();
  const tagSet = new Set();

  data.forEach((quote) => {
    if (quote.author) {
      authorSet.add(quote.author);
    }
    if (quote.tags) {
      quote.tags.forEach((tag) => tagSet.add(tag));
    }
  });

  renderOptions(authorSet, authorFilter, 'Authors');
  renderOptions(tagSet, tagFilter, 'Tags');
}

function setupEvents() {
  searchInput.addEventListener('input', renderQuotes);
  authorFilter.addEventListener('change', renderQuotes);
  tagFilter.addEventListener('change', renderQuotes);
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
      quotes = Array.isArray(data) ? data : [];
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
