const FALLBACK = {
  today: { title: 'Commemoration of St. Paul, Apostle–R (III)', className: 'I Classis', color: 'Red', tonus: 'Tonus Solemnis' },
  readings: { title: 'Mass of the Day', references: ['Acts 13:26–33', 'John 14:1–6'], propers: { introit: 'External propers are temporarily unavailable.', collect: 'O God, who hast taught the multitude of the Gentiles by the preaching of blessed Paul the Apostle: grant us, we beseech Thee, that we who keep his memory may feel the benefit of his patronage.', epistle: 'Acts 13:26–33', gradual: '', alleluia: '', gospel: 'John 14:1–6', offertory: '', secret: '', preface: '', communion: '', postcommunion: '', commemorations: '' } },
  ordo: { summaryLines: ['Commemoration of St. Paul', 'Apostle', 'III class', 'Red'], fullText: 'External Ordo is temporarily unavailable. Fallback: Commemoration of St. Paul, Apostle, III class, Red.' },
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } }); }
async function fetchText(url) { const r = await fetch(url, { headers: { 'user-agent': 'Sacrum Florilegium liturgical dashboard' } }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.text(); }
function strip(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function findRefs(text) { const refs = [...text.matchAll(/\b(?:[1-3]\s*)?[A-Z][a-z]+\s+\d{1,3}[:.]\d{1,3}(?:[–-]\d{1,3})?/g)].map((m) => m[0].replace('.', ':')); return [...new Set(refs)].slice(0, 3); }
function parseOrdo(text) { const clean = strip(text); const color = /\b(Red|White|Green|Violet|Black|Rose)\b/i.exec(clean)?.[1] || FALLBACK.today.color; const klass = /\b([IVX]+)\s+class/i.exec(clean)?.[0] || FALLBACK.today.className; const title = clean.split(/\s{2,}|\|/)[0].slice(0, 90) || FALLBACK.today.title; return { title, className: klass.replace('class', 'Classis'), color, tonus: /solemn/i.test(clean) ? 'Tonus Solemnis' : FALLBACK.today.tonus, summaryLines: [title.replace(/–.*/, '').slice(0, 32), '1960 rubrics', klass, color], fullText: clean }; }
export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url); const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
  const cache = caches.default; const cacheKey = new Request(`${url.origin}/api/liturgical-day?date=${date}&rubrics=1960`); const hit = await cache.match(cacheKey); if (hit) return hit;
  let data = { ...FALLBACK, isFallback: true };
  try {
    // These public sites do not expose a stable JSON API. Parsing is intentionally conservative and falls back if markup changes.
    const [ordoHtml, missalHtml] = await Promise.allSettled([fetchText(`https://1962ordo.today/day/${date}`), fetchText(`https://www.missalemeum.com/en/${date}`)]);
    const ordoText = ordoHtml.status === 'fulfilled' ? ordoHtml.value : '';
    const missalText = missalHtml.status === 'fulfilled' ? strip(missalHtml.value) : '';
    const parsed = parseOrdo(ordoText);
    const refs = findRefs(missalText);
    data = { today: { title: parsed.title, className: parsed.className, color: parsed.color, tonus: parsed.tonus }, readings: { ...FALLBACK.readings, references: refs.length ? refs : FALLBACK.readings.references, propers: { ...FALLBACK.readings.propers, introit: missalText.slice(0, 1200) || FALLBACK.readings.propers.introit } }, ordo: { summaryLines: parsed.summaryLines, fullText: parsed.fullText }, isFallback: false };
  } catch (error) { data.error = String(error.message || error); }
  const response = json(data); waitUntil(cache.put(cacheKey, response.clone())); return response;
}
