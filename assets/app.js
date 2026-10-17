const MONTHS = [
  ["January", "Jan", 31], ["February", "Feb", 28], ["March", "Mar", 31],
  ["April", "Apr", 30], ["May", "May", 31], ["June", "Jun", 30],
  ["July", "Jul", 31], ["August", "Aug", 31], ["September", "Sep", 30],
  ["October", "Oct", 31], ["November", "Nov", 30], ["December", "Dec", 31],
];
const SAINT_PDFS = {
  pictorial: "https://assets.sacrumflorilegium.com/pdfs/little-pictorial-lives-of-the-saints.pdf?v=da52bc45c82ad021c23cbde561db46f5",
  miniature1: "https://assets.sacrumflorilegium.com/pdfs/miniature-lives-of-the-saints-vol-1.pdf?v=4b827501c9cc24499ab8ca5831b8a795",
  miniature2: "https://assets.sacrumflorilegium.com/pdfs/miniature-lives-of-the-saints-vol-2.pdf?v=854791019c97f2e86db17165dc965113",
};
const READER_URL = "https://reader.sacrumflorilegium.com/web/viewer.html";
const DEFAULT_PROJECTS = [
  { id: "biblia", title: "Biblia", url: "https://biblia.sacrumflorilegium.com/" },
  { id: "census", title: "Census", url: "https://florilegium-census.sebastianchannell99.workers.dev/" },
  { id: "librarium", title: "Librarium", url: "https://librarium.sacrumflorilegium.com/" },
  { id: "officium", title: "Officium", url: "https://officium.sacrumflorilegium.com/" },
  { id: "orarium", title: "Orarium", url: "https://orarium.sacrumflorilegium.com/" },
  { id: "propria", title: "Propria", url: "https://propria.sacrumflorilegium.com/" },
];
const now = new Date();
const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
let selectedDate = { ...today };
let matinsLanguage = "English";
let matinsReadings = null;
let matinsRequest = 0;
let liturgicalDayRequest = 0;

initHodie();
renderSites(DEFAULT_PROJECTS);
void loadProjects();

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing Domus element: " + id);
  return element;
}

async function loadProjects() {
  try {
    const response = await fetch("./projects.json", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("Project directory: " + response.status);
    const body = await response.json();
    if (!Array.isArray(body.projects)) throw new Error("Invalid project directory");
    const allowed = new Set(DEFAULT_PROJECTS.map((p) => p.id));
    const projects = body.projects
      .filter((project) => project && allowed.has(project.id) && /^https:\/\//.test(project.url))
      .map((project) => ({
        id: project.id, title: DEFAULT_PROJECTS.find((item) => item.id === project.id).title,
        url: project.url,
      }));
    if (projects.length === 6) renderSites(projects);
  } catch (error) {
    console.warn("Domus is using the checked-in site destinations", error);
  }
}

function renderSites(projects) {
  const grid = requiredElement("site-grid");
  const byId = new Map(projects.map((item) => [item.id, item]));
  const fragment = document.createDocumentFragment();
  for (const fallback of DEFAULT_PROJECTS) {
    const project = byId.get(fallback.id) || fallback;
    const anchor = document.createElement("a");
    anchor.className = "site-tile";
    anchor.href = project.url;
    anchor.textContent = project.title;
    anchor.setAttribute("aria-label", "Open " + project.title);
    fragment.append(anchor);
  }
  grid.replaceChildren(fragment);
}

function isoDate(date) {
  return [date.year, String(date.month + 1).padStart(2, "0"), String(date.day).padStart(2, "0")].join("-");
}

async function loadLiturgicalDay() {
  const date = selectedIsoDate();
  const requestId = ++liturgicalDayRequest;
  const fallback = requiredElement("liturgical-fallback");
  const link = requiredElement("officium-day-link");
  const target = new URL("https://officium.sacrumflorilegium.com/");
  target.searchParams.set("date", date);
  target.searchParams.set("version", "1954");
  target.searchParams.set("hour", "Laudes");
  target.searchParams.set("lang", "English");
  link.href = target.toString();
  try {
    const response = await fetch("./api/liturgical-day?date=" + encodeURIComponent(date), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Office information unavailable (" + response.status + ")");
    const data = await response.json();
    if (requestId !== liturgicalDayRequest) return;
    if (!data || data.date !== date || typeof data.feast !== "string" || !data.feast.trim()) {
      throw new Error("Unrecognized Office heading");
    }
    const feast = requiredElement("liturgical-feast");
    feast.textContent = data.feast;
    feast.classList.toggle("is-rubric", data.feastColor === "rubric");
    const temporal = requiredElement("liturgical-temporal");
    temporal.replaceChildren();
    if (data.temporal) {
      if (data.temporaLabel) {
        const label = document.createElement("span");
        label.className = "temporal-label";
        label.textContent = data.temporaLabel + " ";
        temporal.append(label);
      }
      const value = document.createElement("span");
      value.className = "temporal-value";
      value.textContent = data.temporal;
      temporal.append(value);
    }
    fallback.hidden = true;
  } catch (error) {
    if (requestId !== liturgicalDayRequest) return;
    console.warn("Could not retrieve the Divino Afflatu heading", error);
    const feast = requiredElement("liturgical-feast");
    feast.textContent = "Liturgical day unavailable";
    feast.classList.remove("is-rubric");
    requiredElement("liturgical-temporal").textContent = "1954 · Divino Afflatu";
    fallback.hidden = false;
  }
}


function selectedIsoDate() {
  return isoDate(selectedDate);
}

function selectedLocalDate() {
  return new Date(selectedDate.year, selectedDate.month, selectedDate.day, 12);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2100) return false;
  const local = new Date(year, month - 1, day, 12);
  return local.getFullYear() === year && local.getMonth() === month - 1 && local.getDate() === day;
}

function setHodieDate(date) {
  if (!isValidDate(date)) return;
  const [year, month, day] = date.split("-").map(Number);
  selectedDate = { year, month: month - 1, day };
  updateHodie();
}

function shiftHodieDate(days) {
  const date = selectedLocalDate();
  date.setDate(date.getDate() + days);
  setHodieDate(isoDate({ year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }));
}

function initHodie() {
  requiredElement("hodie-prev").addEventListener("click", () => shiftHodieDate(-1));
  requiredElement("hodie-next").addEventListener("click", () => shiftHodieDate(1));
  const dateButton = requiredElement("hodie-date-button");
  const controls = requiredElement("hodie-date-controls");
  dateButton.addEventListener("click", () => {
    controls.hidden = !controls.hidden;
    dateButton.setAttribute("aria-expanded", String(!controls.hidden));
  });
  requiredElement("hodie-date-picker").addEventListener("change", (event) => setHodieDate(event.target.value));
  requiredElement("hodie-today").addEventListener("click", () => setHodieDate(isoDate(today)));
  requiredElement("hodie-matins").addEventListener("toggle", (event) => {
    if (event.target.open) void loadHodieMatins();
    else matinsRequest++;
  });
  for (const button of document.querySelectorAll("[data-matins-lang]")) {
    button.addEventListener("click", () => {
      matinsLanguage = button.dataset.matinsLang;
      for (const option of document.querySelectorAll("[data-matins-lang]")) {
        option.setAttribute("aria-pressed", String(option === button));
      }
      renderMatinsReadings();
    });
  }
  for (const book of document.querySelectorAll("[data-saints-book]")) {
    book.addEventListener("toggle", () => {
      if (book.open) mountSaintReader(book);
      else unmountSaintReader(book);
    });
  }
  updateHodie();
}

function updateHodie() {
  void loadLiturgicalDay();
  const date = selectedLocalDate();
  const display = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
  requiredElement("hodie-weekday").textContent =
    new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  requiredElement("hodie-date-label").textContent = display;
  requiredElement("hodie-date-picker").value = selectedIsoDate();
  const url = new URL("https://officium.sacrumflorilegium.com/");
  url.searchParams.set("date", selectedIsoDate());
  url.searchParams.set("version", "1954");
  url.searchParams.set("hour", "Matutinum");
  url.searchParams.set("lang", "English");
  url.searchParams.set("view", "lessons");
  requiredElement("hodie-matins-link").href = url.toString();
  renderSaintReaders();
  matinsReadings = null;
  requiredElement("hodie-matins-lessons").replaceChildren();
  requiredElement("hodie-matins-feast").textContent = "";
  requiredElement("hodie-matins-summary").textContent = "Divino Afflatu · 1954";
  if (requiredElement("hodie-matins").open) void loadHodieMatins();
}

function saintReaderLink(book) {
  const pdf = book === "pictorial"
    ? SAINT_PDFS.pictorial
    : SAINT_PDFS[selectedDate.month < 6 ? "miniature1" : "miniature2"];
  const url = new URL(READER_URL);
  url.searchParams.set("file", pdf);
  const day = selectedDate.month === 1 && selectedDate.day === 29 ? 28 : selectedDate.day;
  url.hash = "search=" + encodeURIComponent(MONTHS[selectedDate.month][0] + " " + day) + "&phrase=true";
  return url.toString();
}

function unmountSaintReader(book) {
  const frame = book.querySelector(".saints-book-embed");
  frame.replaceChildren();
  delete frame.dataset.readerUrl;
}

function mountSaintReader(book) {
  if (!book.open) return;
  const kind = book.dataset.saintsBook;
  const url = saintReaderLink(kind);
  const frame = book.querySelector(".saints-book-embed");
  if (frame.dataset.readerUrl === url && frame.querySelector("iframe")) return;
  const iframe = document.createElement("iframe");
  iframe.title = (kind === "pictorial" ? "Little Pictorial Lives" : "Miniature Lives") +
    " — " + MONTHS[selectedDate.month][0] + " " + selectedDate.day;
  iframe.loading = "lazy";
  iframe.src = url;
  frame.replaceChildren(iframe);
  frame.dataset.readerUrl = url;
}

function renderSaintReaders() {
  const date = MONTHS[selectedDate.month][0] + " " + selectedDate.day;
  requiredElement("saints-miniature-volume").textContent =
    "Fr. Henry Sebastian Bowden · Volume " + (selectedDate.month < 6 ? "I" : "II");
  for (const book of document.querySelectorAll("[data-saints-book]")) {
    book.querySelector(".saints-book-link").href = saintReaderLink(book.dataset.saintsBook);
    book.querySelector(".saints-book-date").textContent =
      selectedDate.month === 1 && selectedDate.day === 29 ? date + " · searching February 28" : date;
    if (book.open) mountSaintReader(book);
  }
}

// Matins is read from Officium's existing saved 1954 Office; never copy or maintain a saint calendar.
async function loadHodieMatins() {
  const requestId = ++matinsRequest;
  const selected = selectedIsoDate();
  const status = requiredElement("hodie-matins-status");
  status.textContent = "Loading appointed lessons…";
  status.hidden = false;
  try {
    const response = await fetch("./api/matins?date=" + encodeURIComponent(selected), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Matins unavailable (" + response.status + ")");
    const data = await response.json();
    if (data.date !== selected || typeof data.html !== "string") throw new Error("Invalid Matins response");
    if (requestId !== matinsRequest || !requiredElement("hodie-matins").open) return;
    matinsReadings = selectMatinsLessons(data.html, selected);
    renderMatinsReadings();
  } catch (error) {
    if (requestId !== matinsRequest) return;
    status.textContent = "The 1954 Matins lessons are unavailable for this date. You can still open Officium.";
    requiredElement("hodie-matins-summary").textContent = "Divino Afflatu · 1954";
    console.warn("Could not retrieve Matins lessons", error);
  }
}

function selectMatinsLessons(html, iso) {
  // Each Divinum Officium Matins row contains the corresponding Latin and English readings.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const feast = (doc.querySelector("p font")?.textContent || "").trim();
  const found = new Map();
  for (const row of doc.querySelectorAll("tr")) {
    const cells = Array.from(row.children).filter(cell => cell.tagName === "TD");
    if (cells.length < 2) continue;
    const latin = findLesson(cells[0], "Lectio");
    const english = findLesson(cells[1], "Reading");
    if (latin && english && latin.number === english.number) {
      found.set(latin.number, { number: latin.number, Latin: latin.text, English: english.text });
    }
  }
  const selectedDate = new Date(iso + "T12:00:00");
  const sunday = selectedDate.getDay() === 0;
  const feria = /^(?:Feria|Sabbato|Sabbatum)\b/i.test(feast);
  const saintFeast = /^(?:S\.|Ss\.|B\.|Bb\.|Sanct)/i.test(feast);
  let numbers = [];
  if ([4, 5, 6].every(number => found.has(number)) && !feria) {
    numbers = [4, 5, 6];
  } else if (found.has(3) && saintFeast && !sunday) {
    numbers = [3];
  }
  return { feast, numbers, readings: numbers.map(number => found.get(number)) };
}

function findLesson(cell, language) {
  const marker = Array.from(cell.querySelectorAll("b i")).find(node =>
    new RegExp("^" + language + "\\s+([1-9])$", "i").test(node.textContent.trim()));
  if (!marker) return null;
  const number = Number(marker.textContent.trim().match(/([1-9])$/)?.[1]);
  const heading = marker.closest("font");
  if (!heading) return null;
  const parts = [];
  for (let node = heading.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 1 && node.tagName === "FONT" &&
        node.querySelector("i")?.textContent.trim() === "℣.") break;
    if (node.nodeType === 1 && node.tagName === "BR") parts.push("\n");
    else parts.push(node.textContent || "");
  }
  const content = parts.join("").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  return content ? { number, text: content } : null;
}

function renderMatinsReadings() {
  if (!matinsReadings) return;
  const { feast, numbers, readings } = matinsReadings;
  const summary = requiredElement("hodie-matins-summary");
  const status = requiredElement("hodie-matins-status");
  const container = requiredElement("hodie-matins-lessons");
  requiredElement("hodie-matins-feast").textContent = feast;
  container.replaceChildren();
  if (!numbers.length) {
    summary.textContent = "No additional reading selected";
    status.hidden = false;
    status.textContent = "No separate historical reading is selected for this Office. Continue the Little Office as usual.";
    return;
  }
  const romans = { 3: "III", 4: "IV", 5: "V", 6: "VI" };
  summary.textContent = numbers.length === 1 ? "Lectio III · Divino Afflatu 1954" :
    "Lectiones IV–VI · Divino Afflatu 1954";
  status.hidden = true;
  for (const reading of readings) {
    const section = document.createElement("section");
    section.className = "matins-lesson";
    const heading = document.createElement("h2");
    heading.textContent = "Lectio " + romans[reading.number];
    const paragraph = document.createElement("p");
    paragraph.className = "matins-lesson-text";
    paragraph.textContent = reading[matinsLanguage];
    section.append(heading, paragraph);
    container.append(section);
  }
}
