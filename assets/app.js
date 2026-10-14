const MONTHS = [
  ["January", "Jan", 31], ["February", "Feb", 28], ["March", "Mar", 31],
  ["April", "Apr", 30], ["May", "May", 31], ["June", "Jun", 30],
  ["July", "Jul", 31], ["August", "Aug", 31], ["September", "Sep", 30],
  ["October", "Oct", 31], ["November", "Nov", 30], ["December", "Dec", 31],
];
const PDF_URL = "https://assets.sacrumflorilegium.com/pdfs/little-pictorial-lives-of-the-saints.pdf?v=da52bc45c82ad021c23cbde561db46f5";
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
      renderMonths();
      renderDays();
    });
    fragment.append(button);
  });
  months.replaceChildren(fragment);
}

function readerLink(month, day) {
  const url = new URL(READER_URL);
  url.searchParams.set("file", PDF_URL);
  const searchDay = month === 1 && day === 29 ? 28 : day;
  const hash = new URLSearchParams({
    search: MONTHS[month][0] + " " + searchDay,
    phrase: "true",
  });
  url.hash = hash.toString().replace(/\+/g, "%20");
  return url.toString();
}

function renderDays() {
  const grid = requiredElement("saints-days");
  const fragment = document.createDocumentFragment();
  for (let day = 1; day <= monthLength(selectedMonth); day++) {
    const month = MONTHS[selectedMonth][0];
    const anchor = document.createElement("a");
    anchor.className = "saints-day";
    anchor.href = readerLink(selectedMonth, day);
    anchor.textContent = String(day);
    anchor.setAttribute("aria-label", "Read " + month + " " + day + " in Little Pictorial Lives of the Saints");
    anchor.title = month + " " + day + (selectedMonth === 1 && day === 29 ? " · uses February 28" : "");
    if (selectedMonth === today.month && day === today.day) {
      anchor.classList.add("is-today");
      anchor.setAttribute("aria-current", "date");
    }
    fragment.append(anchor);
  }
  grid.replaceChildren(fragment);
}
