import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';
import { loadQuotes, getFeaturedQuote } from './quoteProvider.js';

function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value || ''; }
function setupMenu() {
  const sideMenu = document.querySelector('.side-menu'); const toggle = document.querySelector('.menu-toggle'); const panel = document.getElementById('siteMenu');
  function setOpen(open){ sideMenu?.classList.toggle('is-open', open); toggle?.setAttribute('aria-expanded', String(open)); panel?.setAttribute('aria-hidden', String(!open)); }
  sideMenu?.addEventListener('click', (event) => { if (event.target.closest('.menu-toggle')) setOpen(!sideMenu.classList.contains('is-open')); if (event.target.closest('.menu-close, .menu-backdrop, .menu-link')) setOpen(false); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
}
function renderQuote(quote) {
  const card = document.getElementById('featuredQuote'); if (!card || !quote) return;
  card.innerHTML = `<div class="quote-mark" aria-hidden="true">“</div>${quote.imageUrl ? `<img class="featured-quote__image" src="${escapeHtml(quote.imageUrl)}" alt="Portrait of ${escapeHtml(quote.author)}" loading="lazy" decoding="async">` : ''}<div class="featured-quote__copy"><p class="featured-quote__text">${escapeHtml(quote.text).replace(/&lt;\/?em&gt;/g,'')}</p><p class="featured-quote__author">${escapeHtml(quote.author)}</p>${quote.source ? `<p class="featured-quote__source">${escapeHtml(quote.source)}</p>` : ''}</div>`;
}
async function init() {
  setupMenu();
  const data = await getLiturgicalDashboardData();
  setText('latinDate', data.date.latinMartyrologyDate); setText('romanYear', data.date.romanYear); setText('todayTitle', data.today.title); setText('todayClass', data.today.className); setText('todayColor', data.today.color); setText('todayTonus', data.today.tonus); setText('readingsTitle', data.readings.title); setText('readingsRefs', data.readings.references.join('\n')); setText('ordoSummary', data.ordo.summaryLines.join('\n'));
  try { renderQuote(getFeaturedQuote(await loadQuotes('data/quotes.json'))); } catch (error) { console.error(error); }
}
window.addEventListener('DOMContentLoaded', init);
