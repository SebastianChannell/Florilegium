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
function feastNameFromOrdo(value) {
  return titleCaseOrdo(value)
    .replace(/^Feria\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.?\s+/i, '')
    .replace(/\s*,?\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s+cl\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function sectionReference(value) {
  const lines = String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => !/^(Reading|A reading|Continuation|Lesson)/i.test(line) && line.length <= 80) || '';
}
function buildPropersSummary(data) {
  const propers = data.readings?.propers || {};
  const epistle = sectionReference(propers.epistle);
  const gospel = sectionReference(propers.gospel);
  return [epistle, gospel].filter(Boolean).join('\n');
}
function setupMenu() {
  const sideMenu = document.querySelector('.side-menu'); const toggle = document.querySelector('.menu-toggle'); const panel = document.getElementById('siteMenu');
  function setOpen(open){ sideMenu?.classList.toggle('is-open', open); toggle?.setAttribute('aria-expanded', String(open)); panel?.setAttribute('aria-hidden', String(!open)); }
  sideMenu?.addEventListener('click', (event) => { if (event.target.closest('.menu-toggle')) setOpen(!sideMenu.classList.contains('is-open')); if (event.target.closest('.menu-close, .menu-backdrop, .menu-link')) setOpen(false); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
}
function setQuoteExpanded(textEl, toggle, expanded) {
  if (!textEl || !toggle) return;
  const wrap = toggle.closest('.featured-quote__text-wrap');
  textEl.style.display = 'block';
  textEl.style.webkitBoxOrient = 'unset';
  textEl.style.webkitLineClamp = 'unset';
  textEl.style.maxHeight = expanded ? 'none' : 'calc(1.45em * 5)';
  textEl.style.overflow = expanded ? 'visible' : 'hidden';
  textEl.style.paddingRight = expanded ? '0' : '2.25rem';
  if (wrap) wrap.style.marginBottom = expanded ? '1.45rem' : '0';
  toggle.style.bottom = expanded ? '-1.25rem' : '.05rem';
  toggle.textContent = expanded ? 'less' : '…';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', expanded ? 'Collapse quote' : 'Expand quote');
}
function renderQuote(quote) {
  const card = document.getElementById('featuredQuote'); if (!card || !quote) return;
  const text = String(quote.text || '');
  const isLong = text.replace(/<\/?em>/g, '').length > 260;
  const quoteMark = '<div class="quote-mark" aria-hidden="true" style="top:.7rem;left:1.2rem;font-size:3.25rem;">“</div>';
  const image = quote.imageUrl ? `<img class="featured-quote__image" style="align-self:start;margin-top:3.85rem;" src="${escapeHtml(quote.imageUrl)}" alt="Portrait of ${escapeHtml(quote.author)}" loading="lazy" decoding="async">` : '';
  const toggle = isLong ? '<button class="featured-quote__toggle" type="button" aria-label="Expand quote" aria-expanded="false" style="position:absolute;right:0;bottom:.05rem;padding:.05rem .55rem .12rem;border:1px solid rgba(132,81,207,.42);border-radius:999px;background:rgba(9,9,9,.92);color:var(--sf-purple);font:inherit;font-weight:800;line-height:1;">…</button>' : '';
  card.innerHTML = `${quoteMark}${image}<div class="featured-quote__copy"><div class="featured-quote__text-wrap" style="position:relative;"><p class="featured-quote__text">${escapeHtml(text).replace(/&lt;\/?em&gt;/g,'')}</p>${toggle}</div><p class="featured-quote__author">${escapeHtml(quote.author)}</p>${quote.source ? `<p class="featured-quote__source">${escapeHtml(quote.source)}</p>` : ''}</div>`;
  if (isLong) {
    const textEl = card.querySelector('.featured-quote__text');
    const toggleEl = card.querySelector('.featured-quote__toggle');
    setQuoteExpanded(textEl, toggleEl, false);
    toggleEl?.addEventListener('click', (event) => {
      event.preventDefault();
      const expanded = toggleEl.getAttribute('aria-expanded') !== 'true';
      setQuoteExpanded(textEl, toggleEl, expanded);
    });
  }
}
async function init() {
  setupMenu();
  const data = await getLiturgicalDashboardData();
  const feastTitle = feastNameFromOrdo(data.today.title);
  setText('latinDate', data.date.latinMartyrologyDate); setText('romanYear', data.date.romanYear); setText('todayTitle', feastTitle); setText('todayClass', data.today.className); setText('todayColor', data.today.color); setText('readingsRefs', buildPropersSummary(data)); setText('ordoSummary', feastTitle);
  try { renderQuote(getFeaturedQuote(await loadQuotes('data/quotes.json'))); } catch (error) { console.error(error); }
}
window.addEventListener('DOMContentLoaded', init);
