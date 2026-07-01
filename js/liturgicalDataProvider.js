import { getLiturgicalDate } from './liturgicalDate.js';

const FALLBACK = {
  today: { title: 'Commemoration of St. Paul, Apostle–R (III)', className: 'I Classis', color: 'Red', tonus: 'Tonus Solemnis' },
  readings: {
    title: 'Mass of the Day',
    references: ['Acts 13:26–33', 'John 14:1–6'],
    propers: {
      introit: 'The daily propers could not be loaded. Please try again later.',
      collect: 'O God, who hast taught the multitude of the Gentiles by the preaching of blessed Paul the Apostle: grant us, we beseech Thee, that we who keep his memory may feel the benefit of his patronage.',
      epistle: 'Acts 13:26–33',
      gradual: '', alleluia: '', gospel: 'John 14:1–6', offertory: '', secret: '', preface: '', communion: '', postcommunion: '', commemorations: '',
    },
  },
  ordo: { summaryLines: ['Commemoration of St. Paul', 'Apostle', 'III class', 'Red'], fullText: 'Fallback Ordo: Commemoration of St. Paul, Apostle, III class, Red.' },
};

const memoryCache = new Map();
function ymd(date) { return date.toISOString().slice(0, 10); }
function cacheKey(date) { return `liturgical-1960-${ymd(date)}`; }
function readCache(key) {
  const stored = typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(key) || 'null');
  const cached = memoryCache.get(key) || stored;
  return cached && cached.expires > Date.now() ? cached.data : null;
}
function writeCache(key, data) {
  const expires = new Date(); expires.setUTCHours(23, 59, 59, 999);
  const payload = { expires: expires.getTime(), data };
  memoryCache.set(key, payload);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(payload)); } catch {}
}
async function fetchProxy(date) {
  const response = await fetch(`/api/liturgical-day?date=${ymd(date)}&rubrics=1960`);
  if (!response.ok) throw new Error('Liturgical proxy unavailable');
  return response.json();
}

function normalize(data, date) {
  return {
    date: getLiturgicalDate(date),
    today: { ...FALLBACK.today, ...(data?.today || {}) },
    readings: { ...FALLBACK.readings, ...(data?.readings || {}), propers: { ...FALLBACK.readings.propers, ...(data?.readings?.propers || {}) } },
    ordo: { ...FALLBACK.ordo, ...(data?.ordo || {}) },
    isFallback: Boolean(data?.isFallback),
  };
}

export async function getLiturgicalDashboardData(date = new Date()) {
  const key = cacheKey(date);
  const cached = readCache(key);
  if (cached) return normalize(cached, date);
  try {
    const data = await fetchProxy(date);
    writeCache(key, data);
    return normalize(data, date);
  } catch (error) {
    console.warn('Using fallback liturgical data.', error);
    return normalize({ ...FALLBACK, isFallback: true }, date);
  }
}
