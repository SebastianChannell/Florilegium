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
let selectedMonth = today.month;
let selectedDay = today.day;

initSaintReaders();
renderMonths();
renderDays();
renderSites(DEFAULT_PROJECTS);
void loadProjects();
void loadLiturgicalDay();

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
  const date = isoDate(today);
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
    console.warn("Could not retrieve the Divino Afflatu heading", error);
    const feast = requiredElement("liturgical-feast");
    feast.textContent = "Today's liturgical day";
    feast.classList.remove("is-rubric");
    requiredElement("liturgical-temporal").textContent = "1954 · Divino Afflatu";
    fallback.hidden = false;
  }
}

function monthLength(index) {
  return index === 1 && isLeapYear(today.year) ? 29 : MONTHS[index][2];
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function selectedDateLabel() {
  return MONTHS[selectedMonth][0] + " " + selectedDay;
}

function saintReaderLink(book) {
  const pdf = book === "pictorial"
    ? SAINT_PDFS.pictorial
    : SAINT_PDFS[selectedMonth < 6 ? "miniature1" : "miniature2"];
  const url = new URL(READER_URL);
  url.searchParams.set("file", pdf);
  // The historic books may not contain a February 29 entry.
  const searchDay = selectedMonth === 1 && selectedDay === 29 ? 28 : selectedDay;
  const search = MONTHS[selectedMonth][0] + " " + searchDay;
  url.hash = "search=" + encodeURIComponent(search) + "&phrase=true";
  return url.toString();
}

function initSaintReaders() {
  requiredElement("saints-today").addEventListener("click", () => {
    selectedMonth = today.month;
    selectedDay = today.day;
    renderMonths();
    renderDays();
  });
  for (const book of document.querySelectorAll(".saints-book")) {
    book.addEventListener("toggle", () => {
      if (book.open) mountSaintReader(book);
      else unmountSaintReader(book);
    });
  }
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
    " — " + selectedDateLabel();
  iframe.loading = "lazy";
  iframe.allowFullscreen = true;
  iframe.src = url;
  // On iframe failures or missing OCR, the full-reader link remains usable.
  frame.replaceChildren(iframe);
  frame.dataset.readerUrl = url;
}

function renderSaintReaders() {
  const date = selectedDateLabel();
  requiredElement("saints-selected-date").textContent = date;
  requiredElement("saints-miniature-volume").textContent =
    "Fr. Henry Sebastian Bowden · Volume " + (selectedMonth < 6 ? "I" : "II");
  for (const book of document.querySelectorAll(".saints-book")) {
    const kind = book.dataset.saintsBook;
    const link = book.querySelector(".saints-book-link");
    link.href = saintReaderLink(kind);
    const label = book.querySelector(".saints-book-date");
    label.textContent = (selectedMonth === 1 && selectedDay === 29)
      ? date + " · searching February 28"
      : date;
    if (book.open) mountSaintReader(book);
  }
}

function renderMonths() {
  const months = requiredElement("saints-months");
  const fragment = document.createDocumentFragment();
  MONTHS.forEach(([fullName, label], index) => {
    const button = document.createElement("button");
    button.className = "saints-month";
    button.type = "button";
    button.textContent = label;
    button.title = fullName;
    button.setAttribute("aria-label", "Show " + fullName);
    button.setAttribute("aria-pressed", String(index === selectedMonth));
    button.addEventListener("click", () => {
      selectedMonth = index;
      selectedDay = Math.min(selectedDay, monthLength(index));
      renderMonths();
      renderDays();
    });
    fragment.append(button);
  });
  months.replaceChildren(fragment);
}

function renderDays() {
  const grid = requiredElement("saints-days");
  const fragment = document.createDocumentFragment();
  for (let day = 1; day <= monthLength(selectedMonth); day++) {
    const month = MONTHS[selectedMonth][0];
    const button = document.createElement("button");
    button.className = "saints-day";
    button.type = "button";
    button.textContent = String(day);
    button.setAttribute("aria-label", "Select " + month + " " + day);
    button.setAttribute("aria-pressed", String(day === selectedDay));
    if (day === selectedDay) button.classList.add("is-selected");
    if (selectedMonth === today.month && day === today.day) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }
    button.addEventListener("click", () => {
      selectedDay = day;
      renderDays();
    });
    fragment.append(button);
  }
  grid.replaceChildren(fragment);
  renderSaintReaders();
}
