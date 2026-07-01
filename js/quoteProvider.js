export function sanitizeQuote(quote) {
  if (!quote || typeof quote !== 'object') return null;
  const text = String(quote.text ?? '').trim();
  if (!text) return null;
  return {
    text,
    author: String(quote.author ?? 'Unknown').trim() || 'Unknown',
    source: String(quote.source ?? '').trim(),
    page: String(quote.page ?? '').trim(),
    imageUrl: String(quote.imageUrl ?? '').trim(),
    tags: Array.isArray(quote.tags) ? quote.tags.map((tag) => String(tag ?? '').trim()).filter(Boolean) : [],
  };
}

export async function loadQuotes(basePath = 'data/quotes.json') {
  const response = await fetch(basePath);
  if (!response.ok) throw new Error('Unable to load quotes.');
  const data = await response.json();
  return (Array.isArray(data) ? data : []).map(sanitizeQuote).filter(Boolean);
}

function seededDailyIndex(date, length) {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let seed = 2166136261;
  for (const char of key) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return Math.abs(seed) % length;
}

export function getFeaturedQuote(quotes, date = new Date()) {
  if (!quotes.length) return null;
  return quotes[seededDailyIndex(date, quotes.length)];
}
