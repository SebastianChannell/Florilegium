import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';
import { loadQuotes, getFeaturedQuote } from './quoteProvider.js';

function escapeHtml(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value || ''; }
function titleCaseOrdo(value) {
  const smallWords = new Set(['a','an','and','as','at','by','for','from','in','nor','of','on','or','the','to','with']);
  const roman = new Set(['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi']);
  const abbreviations = new Map([['bvm','BVM'],['ss','SS'],['st','St.'],['sts','Sts.'],['dom','Dom.'],['feria','Feria']]);
  const words = String(value || '').trim().toLowerCase().split(/(\s+)/);
  let beginsPhrase = true;
  return words.map((part) => {
    if (/^\s+$/.test(part)) return part;
    const match = part.match(/^([^a-z0-9]*)([a-z0-9]+)([^a-z0-9]*)$/i);
    if (!match) return part;
    const [, prefix, word, suffix] = match;
    let rendered;
    if (abbreviations.has(word)) rendered = abbreviations.get(word);
    else if (roman.has(word)) rendered = word.toUpperCase();
    else if (word === 'cl') rendered = 'cl';
    else if (!beginsPhrase && smallWords.has(word)) rendered = word;
    else rendered = word.charAt(0).toUpperCase() + word.slice(1);
    beginsPhrase = /[.!?—–-]$/.test(suffix) || suffix.includes(':');
    return `${prefix}${rendered}${suffix}`;
  }).join('');
}
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
  const formattedTitle = titleCaseOrdo(data.today.title);
  setText('latinDate', data.date.latinMartyrologyDate); setText('romanYear', data.date.romanYear); setText('todayTitle', formattedTitle); setText('todayClass', data.today.className); setText('todayColor', data.today.color); setText('readingsTitle', data.readings.title); setText('readingsRefs', data.readings.references.join('\n')); setText('ordoSummary', formattedTitle);
  try { renderQuote(getFeaturedQuote(await loadQuotes('data/quotes.json'))); } catch (error) { console.error(error); }
}
window.addEventListener('DOMContentLoaded', init);
