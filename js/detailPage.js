import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';

function setupMenu(){const sideMenu=document.querySelector('.side-menu');const toggle=document.querySelector('.menu-toggle');const panel=document.getElementById('siteMenu');function setOpen(open){sideMenu?.classList.toggle('is-open',open);toggle?.setAttribute('aria-expanded',String(open));panel?.setAttribute('aria-hidden',String(!open));}sideMenu?.addEventListener('click',(event)=>{if(event.target.closest('.menu-toggle'))setOpen(!sideMenu.classList.contains('is-open'));if(event.target.closest('.menu-close, .menu-backdrop, .menu-link'))setOpen(false);});window.addEventListener('keydown',(event)=>{if(event.key==='Escape')setOpen(false);});}
function escapeHtml(value){const span=document.createElement('span');span.textContent=String(value ?? '');return span.innerHTML;}
function renderText(value){return escapeHtml(value).replace(/\n/g,'<br>');}
function entry(title, text){return text ? `<section class="proper-section"><h2>${escapeHtml(title)}</h2><p>${renderText(text)}</p></section>` : '';}
function sourceLine(data){const pages=data.ordo?.entry?.sourcePages || [];const pageText=pages.length ? ` · PDF page${pages.length > 1 ? 's' : ''} ${pages.join(', ')}` : '';return `<p class="source-note">Source: ${escapeHtml(data.ordo?.source || 'Romanitas Press Ordo 2026')}${escapeHtml(pageText)}</p>`;}

async function init(){
  setupMenu();
  const data=await getLiturgicalDashboardData();
  const root=document.getElementById('detailContent');
  if(!root)return;

  if(root.dataset.page==='ordo'){
    const mass=data.ordo?.sections?.mass || '';
    const breviary=data.ordo?.sections?.breviary || '';
    root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Ordo</p><h1>${escapeHtml(data.today.title || '1962 Ordo')}</h1><p class="ordo-lines">${renderText((data.ordo.summaryLines || []).join('\n'))}</p>${entry('Mass of the Day',mass)}${entry('Breviary',breviary)}${sourceLine(data)}</article>`;
    return;
  }

  const mass=data.readings?.mass?.primary || data.readings?.references?.[0] || '';
  root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Mass of the Day</p><h1>${escapeHtml(data.today.title || data.readings.title)}</h1><p class="sf-muted">${renderText([data.today.className, data.today.color].filter(Boolean).join(' · '))}</p>${entry('Mass',mass)}${sourceLine(data)}</article>`;
}
window.addEventListener('DOMContentLoaded',init);
