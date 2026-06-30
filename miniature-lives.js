const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const card = document.getElementById('saintCard');
const dateSelector = document.getElementById('dateSelector');
const previousDay = document.getElementById('previousDay');
const nextDay = document.getElementById('nextDay');
const todayButton = document.getElementById('todayButton');
const sideMenu = document.querySelector('.side-menu');
const menuToggle = document.querySelector('.menu-toggle');
const menuPanel = document.getElementById('siteMenu');
let entries = new Map();
let selectedDate = new Date();

function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
function pad(n) { return String(n).padStart(2, '0'); }
function keyFromDate(date) { return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function inputValue(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function displayDate(entry, date) { return entry ? `${entry.month} ${entry.day}` : `${MONTHS[date.getMonth()]} ${date.getDate()}`; }
function addDays(date, delta) { const next = new Date(date); next.setDate(next.getDate() + delta); return next; }
function setMenuOpen(isOpen) { sideMenu?.classList.toggle('is-open', isOpen); menuToggle?.setAttribute('aria-expanded', String(isOpen)); menuPanel?.setAttribute('aria-hidden', String(!isOpen)); }

function renderParagraphs(paragraphs, className) {
  if (!paragraphs?.length) return '<p class="scan-gap">This section is missing from the current scan/conversion.</p>';
  return paragraphs.map((paragraph) => `<p class="${className}">${escapeHtml(paragraph)}</p>`).join('');
}

function render() {
  const key = keyFromDate(selectedDate);
  const entry = entries.get(key);
  dateSelector.value = inputValue(selectedDate);
  if (!entry) {
    card.innerHTML = `<p class="saint-date">${escapeHtml(displayDate(null, selectedDate))}</p><h2>This entry is missing from the current scan/conversion.</h2><p class="scan-gap">Please choose another date, or run the parser again after adding more source text.</p>`;
    return;
  }
  card.innerHTML = `
    <p class="saint-date">${escapeHtml(displayDate(entry, selectedDate))}</p>
    <h2>${escapeHtml(entry.saint)}</h2>
    ${entry.virtue ? `<p class="virtue"><span>Virtue</span>${escapeHtml(entry.virtue)}</p>` : ''}
    <section class="saint-section"><h3>Life</h3>${renderParagraphs(entry.life, 'saint-paragraph')}</section>
    <section class="saint-section devotion-section"><h3>${escapeHtml(entry.devotionTitle || 'Devotion')}</h3>${renderParagraphs(entry.devotionSections, 'devotion-paragraph')}</section>
    <p class="entry-source">${escapeHtml(entry.source)}</p>`;
}

function choose(date) { selectedDate = date; render(); }

function initEvents() {
  previousDay.addEventListener('click', () => choose(addDays(selectedDate, -1)));
  nextDay.addEventListener('click', () => choose(addDays(selectedDate, 1)));
  todayButton.addEventListener('click', () => choose(new Date()));
  dateSelector.addEventListener('change', () => { if (dateSelector.value) choose(new Date(`${dateSelector.value}T00:00:00`)); });
  sideMenu?.addEventListener('click', (event) => {
    if (event.target.closest('.menu-toggle')) setMenuOpen(!sideMenu.classList.contains('is-open'));
    if (event.target.closest('.menu-close, .menu-backdrop, .menu-link')) setMenuOpen(false);
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenuOpen(false); });
}

fetch('../data/miniature-lives.json')
  .then((response) => { if (!response.ok) throw new Error('Unable to load miniature lives.'); return response.json(); })
  .then((data) => { entries = new Map((Array.isArray(data) ? data : []).map((entry) => [entry.dateKey, entry])); initEvents(); render(); })
  .catch((error) => { console.error(error); card.innerHTML = '<p class="empty-state">Unable to load Miniature Lives at this time.</p>'; });
