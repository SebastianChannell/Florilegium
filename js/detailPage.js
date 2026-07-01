import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';

function setupMenu() {
  const sideMenu = document.querySelector('.side-menu');
  const toggle = document.querySelector('.menu-toggle');
  const panel = document.getElementById('siteMenu');
  function setOpen(open) {
    sideMenu?.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    panel?.setAttribute('aria-hidden', String(!open));
  }
  sideMenu?.addEventListener('click', (event) => {
    if (event.target.closest('.menu-toggle')) setOpen(!sideMenu.classList.contains('is-open'));
    if (event.target.closest('.menu-close, .menu-backdrop, .menu-link')) setOpen(false);
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
}

function escapeHtml(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

function formatText(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function properEntry(title, text) {
  return text ? `<section class="proper-section"><h2>${escapeHtml(title)}</h2><p>${formatText(text)}</p></section>` : '';
}

function renderOrdo(data) {
  const sections = Array.isArray(data.ordo.breviary?.sections) ? data.ordo.breviary.sections : [];
  const breviaryHtml = sections.length
    ? sections.map((section) => `<p class="ordo-detail-line"><strong>${escapeHtml(section.label)}:</strong> ${formatText(section.text)}</p>`).join('')
    : `<p>${formatText(data.ordo.fullText)}</p>`;

  return `<article class="sf-card detail-card ordo-detail-card">
    <p class="sf-label">Ordo</p>
    <h1>${escapeHtml(data.ordo.feastName || data.today.title)}</h1>
    <p class="sf-muted">${escapeHtml(data.ordo.className || data.today.className)} · ${escapeHtml(data.ordo.color || data.today.color)}</p>
    <section class="ordo-detail-section">
      <h2>Mass:</h2>
      <p>${formatText(data.ordo.mass || 'Mass information is temporarily unavailable.')}</p>
    </section>
    <section class="ordo-detail-section">
      <h2>Breviary:</h2>
      ${breviaryHtml}
    </section>
  </article>`;
}

async function init() {
  setupMenu();
  const data = await getLiturgicalDashboardData();
  const root = document.getElementById('detailContent');
  if (!root) return;
  if (root.dataset.page === 'ordo') {
    root.innerHTML = renderOrdo(data);
    return;
  }
  const p = data.readings.propers;
  root.innerHTML = `<article class="sf-card detail-card"><p class="sf-label">Mass Propers</p><h1>${escapeHtml(data.readings.title)}</h1><p class="sf-muted">${escapeHtml(data.readings.references.join(' · '))}</p>${properEntry('Introit', p.introit)}${properEntry('Collect', p.collect)}${properEntry('Epistle / Lesson', p.epistle)}${properEntry('Gradual', p.gradual)}${properEntry('Alleluia / Tract', p.alleluia || p.tract)}${properEntry('Gospel', p.gospel)}${properEntry('Offertory', p.offertory)}${properEntry('Secret', p.secret)}${properEntry('Preface', p.preface)}${properEntry('Communion', p.communion)}${properEntry('Postcommunion', p.postcommunion)}${properEntry('Commemorations', p.commemorations)}</article>`;
}

window.addEventListener('DOMContentLoaded', init);
