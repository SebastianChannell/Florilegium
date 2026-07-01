import { getLiturgicalDate } from './liturgicalDate.js';
import { getPropersForDate } from './missalPropersProvider.js';

const ORDO_YEAR = 2026;
const ORDO_DATA_DIR = '/data/ordo/2026';
const FIELD_NAMES = ['title', 'rank', 'color', 'holyDayOrSunday', 'massPrimary', 'breviaryOffice', 'vespers', 'compline', 'sourcePages'];
const monthCache = new Map();

const EMPTY_PROPERS = { introit: '', collect: '', epistle: '', gradual: '', alleluia: '', tract: '', gospel: '', offertory: '', secret: '', preface: '', communion: '', postcommunion: '', commemorations: '' };

const FALLBACK = {
  date: null,
  today: { title: 'Daily Ordo unavailable', className: '', color: '', tonus: '' },
  readings: {
    title: 'Mass of the Day',
    references: [],
    mass: { primary: '', options: [] },
    propers: EMPTY_PROPERS,
    properSource: null,
  },
  ordo: {
    summaryLines: ['The local Romanitas Ordo data could not be loaded.'],
    fullText: '',
    sections: { mass: '', breviary: '' },
    entry: null,
    source: 'Romanitas Press Ordo 2026',
  },
  isFallback: true,
};

function ymdLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function titleCase(value) {
  return String(value || '').replace(/^./, (first) => first.toUpperCase());
}

function snippet(value, max = 74) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || '').trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function loadMonth(monthKey) {
  if (monthCache.has(monthKey)) return monthCache.get(monthKey);
  const response = await fetch(`${ORDO_DATA_DIR}/${monthKey}.b64`, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Missing Ordo data for ${monthKey}`);
  const payload = JSON.parse(decodeBase64Utf8(await response.text()));
  monthCache.set(monthKey, payload);
  return payload;
}

function expandEntry(dateKey, row) {
  if (!Array.isArray(row)) return null;
  const record = Object.fromEntries(FIELD_NAMES.map((key, index) => [key, row[index] ?? '']));
  return {
    date: dateKey,
    title: record.title,
    rank: record.rank,
    color: record.color,
    holyDayOrSunday: Boolean(record.holyDayOrSunday),
    sourcePages: Array.isArray(record.sourcePages) ? record.sourcePages : [],
    mass: { primary: record.massPrimary || '', options: [] },
    breviary: {
      office: record.breviaryOffice || '',
      vespers: record.vespers || '',
      compline: record.compline || '',
    },
  };
}

function buildBreviaryText(breviary) {
  return [
    breviary.office && `Office: ${breviary.office}`,
    breviary.vespers && `Vespers: ${breviary.vespers}`,
    breviary.compline && `Compline: ${breviary.compline}`,
  ].filter(Boolean).join('\n\n');
}

function buildSummary(entry) {
  return [
    entry.mass.primary && `Mass: ${snippet(entry.mass.primary)}`,
    entry.breviary.office && `Office: ${snippet(entry.breviary.office)}`,
    [entry.rank, titleCase(entry.color)].filter(Boolean).join(' · '),
  ].filter(Boolean);
}

function normalizeFromEntry(entry, date, properData = null) {
  const breviaryText = buildBreviaryText(entry.breviary);
  const properSections = { ...EMPTY_PROPERS, ...(properData?.propers || {}) };
  const readingRefs = properData?.references?.length ? properData.references : [snippet(entry.mass.primary, 96)].filter(Boolean);

  return {
    date: getLiturgicalDate(date),
    today: {
      title: entry.title || '1962 Ordo',
      className: entry.rank || '',
      color: titleCase(entry.color),
      tonus: '—',
    },
    readings: {
      title: 'Mass of the Day',
      references: readingRefs,
      mass: entry.mass,
      propers: properSections,
      properId: properData?.properId || '',
      properTitle: properData?.title || '',
      properSource: properData?.source || null,
      properSourcePaths: properData?.sourcePaths || [],
    },
    ordo: {
      summaryLines: buildSummary(entry),
      fullText: [entry.mass.primary && `Mass:\n${entry.mass.primary}`, breviaryText && `Breviary:\n${breviaryText}`].filter(Boolean).join('\n\n'),
      sections: { mass: entry.mass.primary || '', breviary: breviaryText },
      entry,
      source: 'Romanitas Press Ordo 2026',
    },
    isFallback: false,
  };
}

export async function getLiturgicalDashboardData(date = new Date()) {
  const key = ymdLocal(date);
  if (Number(key.slice(0, 4)) !== ORDO_YEAR) {
    return { ...FALLBACK, date: getLiturgicalDate(date), ordo: { ...FALLBACK.ordo, summaryLines: [`No local Ordo data is available for ${key.slice(0, 4)}.`] } };
  }

  try {
    const month = await loadMonth(key.slice(0, 7));
    const entry = expandEntry(key, month?.d?.[key.slice(8, 10)]);
    if (!entry) throw new Error(`No Ordo entry for ${key}`);
    const properData = await getPropersForDate(key);
    return normalizeFromEntry(entry, date, properData);
  } catch (error) {
    console.warn('Using fallback Ordo data.', error);
    return { ...FALLBACK, date: getLiturgicalDate(date) };
  }
}
