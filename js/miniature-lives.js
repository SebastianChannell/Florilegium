const entryEl = document.getElementById('saintEntry');
const dateSelector = document.getElementById('dateSelector');
const prevDay = document.getElementById('prevDay');
const nextDay = document.getElementById('nextDay');
const todayButton = document.getElementById('todayButton');
const sideMenu = document.querySelector('.side-menu');
const menuToggle = document.querySelector('.menu-toggle');
const menuPanel = document.getElementById('siteMenu');

let entriesByDate = new Map();
let selectedDate = new Date();

function pad(value) { return String(value).padStart(2, '0'); }
function keyFromDate(date) { return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function isoDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function displayDate(date) { return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }); }
function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }

const scripturePattern = /\b((?:[1-3]\s*)?[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)?\.?\s+(?:\d+|[ivxlcdm]+)[.:]\s*(?:\d+(?:[–-]\d+)?|[ivxlcdm]+)(?:\s*[–-]\s*\d+)?)\b/gi;

function normalizeScriptureReferences(value) {
  return String(value ?? '').replace(/\b((?:[1-3]\s*)?[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+)?\.?)\s+([IVXLCDM]+)\.\s*(\d+)/g, (match, book, chapter, verse) => {
    return `${book} ${chapter.toLowerCase()}. ${verse}`;
  });
}

function formatParagraphText(value) {
  return escapeHtml(normalizeScriptureReferences(value)).replace(scripturePattern, '<span class="scripture-ref scripture_ref">$1</span>');
}

function isBiblicalQuote(value) {
  scripturePattern.lastIndex = 0;
  return scripturePattern.test(String(value ?? ''));
}

function renderParagraphs(items, className) {
  if (!items?.length) return '<p class="missing-copy">This section is missing from the current scan/conversion.</p>';
  return items.map((item) => {
    const quoteClass = isBiblicalQuote(item) ? ' biblical-quote' : '';
    return `<p class="${className}${quoteClass}">${formatParagraphText(item)}</p>`;
  }).join('');
}

function renderEntry() {
  const dateKey = keyFromDate(selectedDate);
  const entry = entriesByDate.get(dateKey);
  dateSelector.value = isoDate(selectedDate);

  if (!entry) {
    entryEl.innerHTML = `<p class="entry-date">${escapeHtml(displayDate(selectedDate))}</p><h2>This entry is missing from the current scan/conversion.</h2>`;
    return;
  }

  entryEl.innerHTML = `
    <p class="entry-date">${escapeHtml(displayDate(selectedDate))}</p>
    <h2>${escapeHtml(entry.saint)}</h2>
    <p class="entry-virtue"><span>Virtue</span>${escapeHtml(entry.virtue || 'Not listed')}</p>
    <section class="entry-section"><h3>Life</h3>${renderParagraphs(entry.life, 'life-paragraph')}</section>
    <section class="entry-section entry-section--devotion"><h3>${escapeHtml(entry.devotionTitle || 'Devotion')}</h3>${renderParagraphs(entry.devotionSections, 'devotion-paragraph')}</section>
    <p class="entry-source">Volume ${escapeHtml(entry.volume)}</p>
  `;
}

function setMenuOpen(isOpen) {
  sideMenu?.classList.toggle('is-open', isOpen);
  menuToggle?.setAttribute('aria-expanded', String(isOpen));
  menuToggle?.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  menuPanel?.setAttribute('aria-hidden', String(!isOpen));
}

function setupEvents() {
  prevDay.addEventListener('click', () => { selectedDate = addDays(selectedDate, -1); renderEntry(); });
  nextDay.addEventListener('click', () => { selectedDate = addDays(selectedDate, 1); renderEntry(); });
  todayButton.addEventListener('click', () => { selectedDate = new Date(); renderEntry(); });
  dateSelector.addEventListener('change', () => { if (dateSelector.value) selectedDate = new Date(`${dateSelector.value}T12:00:00`); renderEntry(); });
  sideMenu?.addEventListener('click', (event) => {
    if (event.target.closest('.menu-toggle')) setMenuOpen(!sideMenu.classList.contains('is-open'));
    if (event.target.closest('.menu-close, .menu-backdrop, .menu-link')) setMenuOpen(false);
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenuOpen(false); });
}

window.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  fetch('../data/miniature-lives/entries.json')
    .then((response) => { if (!response.ok) throw new Error('Unable to load Miniature Lives.'); return response.json(); })
    .then((entries) => { entriesByDate = new Map(entries.map((entry) => [entry.dateKey, entry])); renderEntry(); })
    .catch((error) => { console.error(error); entryEl.innerHTML = '<p class="missing-copy">Unable to load the Miniature Lives at this time.</p>'; });
});
