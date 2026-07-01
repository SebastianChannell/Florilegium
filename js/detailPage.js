import { getLiturgicalDashboardData } from './liturgicalDataProvider.js';

function setupMenu(){const sideMenu=document.querySelector('.side-menu');const toggle=document.querySelector('.menu-toggle');const panel=document.getElementById('siteMenu');function setOpen(open){sideMenu?.classList.toggle('is-open',open);toggle?.setAttribute('aria-expanded',String(open));panel?.setAttribute('aria-hidden',String(!open));}sideMenu?.addEventListener('click',(event)=>{if(event.target.closest('.menu-toggle'))setOpen(!sideMenu.classList.contains('is-open'));if(event.target.closest('.menu-close, .menu-backdrop, .menu-link'))setOpen(false);});window.addEventListener('keydown',(event)=>{if(event.key==='Escape')setOpen(false);});}
function escapeHtml(value){const span=document.createElement('span');span.textContent=String(value ?? '');return span.innerHTML;}
function renderText(value){return escapeHtml(value).replace(/\n/g,'<br>');}
function titleCaseOrdo(value){
  const smallWords=new Set(['a','an','and','as','at','by','for','from','in','nor','of','on','or','the','to','with']);
  const roman=new Set(['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi']);
  const abbreviations=new Map([['bvm','BVM'],['ss','SS'],['st','St.'],['sts','Sts.'],['dom','Dom.'],['feria','Feria']]);
  const words=String(value || '').trim().toLowerCase().split(/(\s+)/);
  let beginsPhrase=true;
  return words.map((part)=>{
    if(/^\s+$/.test(part)) return part;
    const match=part.match(/^([^a-z0-9]*)([a-z0-9]+)([^a-z0-9]*)$/i);
    if(!match) return part;
    const [,prefix,word,suffix]=match;
    let rendered;
    if(abbreviations.has(word)) rendered=abbreviations.get(word);
    else if(roman.has(word)) rendered=word.toUpperCase();
    else if(word==='cl') rendered='cl';
    else if(!beginsPhrase && smallWords.has(word)) rendered=word;
    else rendered=word.charAt(0).toUpperCase()+word.slice(1);
    beginsPhrase=/[.!?—–-]$/.test(suffix) || suffix.includes(':');
    return `${prefix}${rendered}${suffix}`;
  }).join('');
}
function feastNameFromOrdo(value){
  return titleCaseOrdo(value)
    .replace(/^Feria\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.?\s+/i,'')
    .replace(/\s*,?\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\s+cl\.?$/i,'')
    .replace(/\s+/g,' ')
    .trim();
}
function isReferenceLine(line){return /^(?:[1-3]\s*)?[A-Z][A-Za-z. ]+\s+\d+\s*[:.,]\s*\d/.test(line.trim());}
function isVersicleLine(line){return /^V\.\s+/i.test(line.trim());}
function isGospelOpeningLine(line){return /^Continuation\s*\+?\s+of\b/i.test(line.trim());}
function accentLine(line){return `<span class="proper-accent" style="color:var(--sf-purple);font-style:italic;">${escapeHtml(line)}</span>`;}
function accentVersicle(line){const match=String(line || '').match(/^(\s*)(V\.)(\s*)(.*)$/i);if(!match)return escapeHtml(line);return `${escapeHtml(match[1])}<span class="proper-accent" style="color:var(--sf-purple);font-style:italic;">${escapeHtml(match[2])}</span>${escapeHtml(match[3]+match[4])}`;}
function accentGospelCross(line){const match=String(line || '').match(/^(.*?)(\+)(.*)$/);if(!match)return escapeHtml(line);return `${escapeHtml(match[1])}<span class="proper-accent" style="color:var(--sf-purple);">${escapeHtml(match[2])}</span>${escapeHtml(match[3])}`;}
function renderProperText(value){
  return String(value || '').split('\n').map((line)=>{
    const trimmed=line.trim();
    if(!trimmed)return '';
    if(isReferenceLine(trimmed))return accentLine(line);
    if(isVersicleLine(trimmed))return accentVersicle(line);
    if(isGospelOpeningLine(trimmed))return accentGospelCross(line);
    return escapeHtml(line);
  }).join('<br>');
}
function entry(title, text, options={}){const renderer=options.plain ? renderText : renderProperText;return text ? `<section class="proper-section"><h2>${escapeHtml(title)}</h2><p>${renderer(text)}</p></section>` : '';}
function sourceNote(text){return `<p class="source-note" style="margin:1.65rem 0 0;padding-top:.75rem;color:var(--sf-purple);font-style:italic;text-align:center;line-height:1.55;">${escapeHtml(text)}</p>`;}
function sourceLine(data){const pages=data.ordo?.entry?.sourcePages || [];const pageText=pages.length ? ` · PDF page${pages.length > 1 ? 's' : ''} ${pages.join(', ')}` : '';return sourceNote(`Source: ${data.ordo?.source || 'Romanitas Press Ordo 2026'}${pageText}`);}
function properSourceLine(data){const source=data.readings?.properSource;const paths=data.readings?.properSourcePaths || [];const pathText=paths.length ? ` · ${paths.join(' · ')}` : '';return sourceNote(`Propers source: ${source?.name || 'Divinum Officium'}${pathText}`);}
function hasAnyProper(propers){return Object.values(propers || {}).some((value)=>String(value || '').trim());}
function renderPropers(propers){return `${entry('Introit',propers.introit)}${entry('Collect',propers.collect)}${entry('Epistle / Lesson',propers.epistle)}${entry('Gradual',propers.gradual)}${entry('Alleluia',propers.alleluia)}${entry('Tract',propers.tract)}${entry('Gospel',propers.gospel)}${entry('Offertory',propers.offertory)}${entry('Secret',propers.secret)}${entry('Preface',propers.preface)}${entry('Communion',propers.communion)}${entry('Postcommunion',propers.postcommunion)}${entry('Commemorations',propers.commemorations)}`;}

async function init(){
  setupMenu();
  const data=await getLiturgicalDashboardData();
  const root=document.getElementById('detailContent');
  if(!root)return;

  if(root.dataset.page==='ordo'){
    const mass=data.ordo?.sections?.mass || '';
    const breviary=data.ordo?.sections?.breviary || '';
    root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Ordo</p><h1>${escapeHtml(titleCaseOrdo(data.today.title || '1962 Ordo'))}</h1>${entry('Mass of the Day',mass,{plain:true})}${entry('Breviary',breviary,{plain:true})}${sourceLine(data)}</article>`;
    return;
  }

  const p=data.readings?.propers || {};
  const mass=data.readings?.mass?.primary || data.readings?.references?.[0] || '';
  const hasPropers=hasAnyProper(p);
  const propersTitle=feastNameFromOrdo(data.today.title || data.readings.title);
  root.innerHTML=`<article class="sf-card detail-card"><p class="sf-label">Mass of the Day</p><h1>${escapeHtml(propersTitle)}</h1><p class="sf-muted">${renderText([data.today.className, data.today.color].filter(Boolean).join(' · '))}</p>${hasPropers ? renderPropers(p) : entry('Mass assignment',mass)}${hasPropers ? properSourceLine(data) : sourceLine(data)}</article>`;
}
window.addEventListener('DOMContentLoaded',init);
