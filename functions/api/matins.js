// Read-only Domus adapter for Officium's saved 1954 Matins; no other repository changes.
const SOURCE = "https://officium.sacrumflorilegium.com/data/office/1954/English/";
export async function onRequestGet({ request }) {
  const date = new URL(request.url).searchParams.get("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
      Number.isNaN(Date.parse(date + "T12:00:00Z")) ||
      new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date) {
    return Response.json({ error: "A valid YYYY-MM-DD date is required." }, { status: 400 });
  }
  try {
    const upstream = await fetch(SOURCE + date + "/Matutinum.json", {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!upstream.ok) throw new Error("Officium returned " + upstream.status);
    const data = await upstream.json();
    if (data.date !== date || data.version !== "1954" || data.hour !== "Matutinum" ||
        typeof data.html !== "string" || !data.html.includes("Lectio")) {
      throw new Error("Unexpected Matins data");
    }
    return Response.json({ date, html: data.html }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    console.error("Matins source unavailable", String(error));
    return Response.json({ error: "The saved 1954 Matins Office is unavailable for this date." }, {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
}
