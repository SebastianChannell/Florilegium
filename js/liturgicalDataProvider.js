import { getLiturgicalDate } from './liturgicalDate.js';

const FALLBACK = {
  today: { title: 'Daily Ordo unavailable', className: '', color: '', tonus: '' },
  readings: {
    title: 'Mass of the Day',
    references: [],
    propers: {
      introit: 'The daily propers could not be loaded. Please try again later.',
      collect: 'The daily collect could not be loaded. Please try again later.',
      epistle: '',
      gradual: '', alleluia: '', gospel: '', offertory: '', secret: '', preface: '', communion: '', postcommunion: '', commemorations: '',
    },
  },
  ordo: {
    summaryLines: ['Open the Ordo page for Mass and Breviary.'],
    fullText: '',
    sections: { mass: '', breviary: '' },
    sourceUrl: 'https://1962ordo.today',
  },
};

const memoryCache = new Map();
function ymd(date) { return date.toISOString().slice(0, 10); }
function cacheKey(date) { return `liturgical-1960-v2-${ymd(date)}`; }
function isUsefulOrdo(data) {
  const mass = data?.ordo?.sections?.mass || '';
  const breviary = data?.ordo?.sections?.breviary || '';
  return Boolean(mass.trim() || breviary.trim() || !data?.isFallback);
}
function readCache(key) {
  let stored = null;
  try { stored = typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  const cached = memoryCache.get(key) || stored;
  if (!cached || cached.expires <= Date.now() || cached.data?.isFallback || !isUsefulOrdo(cached.data)) return null;
  return cached.data;
}
function writeCache(key, data) {
  if (data?.isFallback || !isUsefulOrdo(data)) return;
  const expires = new Date(); expires.setUTCHours(23, 59, 59, 999);
  const payload = { expires: expires.getTime(), data };
  memoryCache.set(key, payload);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(payload)); } catch {}
}
async function fetchProxy(date) {
  const response = await fetch(`/api/liturgical-day?date=${ymd(date)}&rubrics=1960`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Liturgical proxy unavailable');
  return response.json();
}

function normalize(data, date) {
  return {
    date: getLiturgicalDate(date),
    today: { ...FALLBACK.today, ...(data?.today || {}) },
    readings: { ...FALLBACK.readings, ...(data?.readings || {}), propers: { ...FALLBACK.readings.propers, ...(data?.readings?.propers || {}) } },
    ordo: { ...FALLBACK.ordo, ...(data?.ordo || {}), sections: { ...FALLBACK.ordo.sections, ...(data?.ordo?.sections || {}) } },
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
