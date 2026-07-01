import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';

function setupMenu(){const sideMenu=document.querySelector('.side-menu');const toggle=document.querySelector('.menu-toggle');const panel=document.getElementById('siteMenu');function setOpen(open){sideMenu?.classList.toggle('is-open',open);toggle?.setAttribute('aria-expanded',String(open));panel?.setAttribute('aria-hidden',String(!open));}sideMenu?.addEventListener('click',(event)=>{if(event.target.closest('.menu-toggle'))setOpen(!sideMenu.classList.contains('is-open'));if(event.target.closest('.menu-close, .menu-backdrop, .menu-link'))setOpen(false);});window.addEventListener('keydown',(event)=>{if(event.key==='Escape')setOpen(false);});}
function escapeHtml(value){const span=document.createElement('span');span.textContent=String(value ?? '');return span.innerHTML;}
function renderText(value){return escapeHtml(value).replace(/\n/g,'<br>');}
function entry(title, text){return text ? `<section class="proper-section"><h2>${escapeHtml(title)}</h2><p>${renderText(text)}</p></section>` : '';}
function ordoEntry(title, text){return text ? `<section class="proper-section ordo-section"><h2>${escapeHtml(title)}</h2><p>${renderText(text)}</p></section>` : '';}

async function init(){
  setupMenu();
  const data=await getLiturgicalDashboardData();
  const root=document.getElementById('detailContent');
  if(!root)return;
  if(root.dataset.page==='ordo'){
    const sections=data.ordo?.sections || {};
    const mass=sections.mass || '';
    const breviary=sections.breviary || '';
    const fallback=!mass&&!breviary ? data.ordo.fullText : '';
    root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Ordo</p><h1>${escapeHtml(data.today.title)}</h1><p class="ordo-lines">${renderText((data.ordo.summaryLines || []).join('\n'))}</p>${ordoEntry('Mass',mass)}${ordoEntry('Breviary',breviary)}${entry('Full Ordo',fallback)}${data.ordo.sourceUrl ? `<p class="source-note">Source: <a href="${escapeHtml(data.ordo.sourceUrl)}" rel="noopener noreferrer">1962 Ordo</a></p>` : ''}</article>`;
    return;
  }
  const p=data.readings.propers;
  root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Mass Propers</p><h1>${escapeHtml(data.readings.title)}</h1><p class="sf-muted">${renderText(data.readings.references.join(' · '))}</p>${entry('Introit',p.introit)}${entry('Collect',p.collect)}${entry('Epistle / Lesson',p.epistle)}${entry('Gradual',p.gradual)}${entry('Alleluia / Tract',p.alleluia||p.tract)}${entry('Gospel',p.gospel)}${entry('Offertory',p.offertory)}${entry('Secret',p.secret)}${entry('Preface',p.preface)}${entry('Communion',p.communion)}${entry('Postcommunion',p.postcommunion)}${entry('Commemorations',p.commemorations)}</article>`;
}
window.addEventListener('DOMContentLoaded',init);
