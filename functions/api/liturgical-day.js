// Domus-only read-only adapter to the saved Divinum Officium 1954 data.
// No Officium application code or data is changed.
const OFFICIUM_ORIGIN = "https://officium.sacrumflorilegium.com";
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestGet({ request }) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !VALID_DATE.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z"))
      || new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date) {
    return Response.json({ error: "Supply a valid date in YYYY-MM-DD format." }, { status: 400 });
  }

  const source = OFFICIUM_ORIGIN + "/data/office/1954/English/" + date + "/Laudes.json";
  try {
    const response = await fetch(source, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!response.ok) throw new Error("Officium asset status " + response.status);
    const data = await response.json();
    if (!data || data.date !== date || typeof data.html !== "string") {
      throw new Error("Unexpected Officium asset");
    }
    const day = parseHeading(data.html);
    if (!day.feast) throw new Error("Officium day title missing");
    return Response.json({ date, ...day }, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not read saved 1954 Office day", String(error));
    return Response.json({ error: "The liturgical day is temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
}

export function parseHeading(html) {
  const firstParagraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
  // In Divinum Officium, the sanctoral title is rubric red, Tempora maroon,
  // and the temporal day is green. Return text only; render with Domus CSS.
  const titleFont = firstParagraph.match(/<font\b([^>]*)>([\s\S]*?)<\/font>/i);
  const feast = titleFont ? cleanText(titleFont[2]) : "";
  const feastColor = titleFont && /\bcolor\s*=\s*["']?red\b/i.test(titleFont[1]) ? "rubric" : "normal";
  const temporaLabel = extract(firstParagraph, /<span\b[^>]*\bstyle\s*=\s*["'][^"']*color\s*:\s*maroon[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const temporal = extract(firstParagraph, /<font\b[^>]*\bcolor\s*=\s*["']?green["']?[^>]*>([\s\S]*?)<\/font>/i);
  return { feast, feastColor, temporaLabel, temporal };
}

function extract(html, expression) {
  const match = html.match(expression);
  if (!match) return "";
  return cleanText(match[1]);
}

function cleanText(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, " ")
    .trim();
}
