const searchForm = requiredElement("search-form");
const searchInput = requiredElement("search-input");
const resultCount = requiredElement("result-count");
const statusMessage = requiredElement("status-message");
const projectList = requiredElement("project-list");

const titleCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const state = {
  projects: [],
  query: new URLSearchParams(window.location.search).get("q")?.trim() ?? "",
};

searchInput.value = state.query;

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchInput.blur();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim();
  updateAddressBar(state.query);
  renderProjects();
});

await loadProjects();

async function loadProjects() {
  setLoadingState();

  try {
    const response = await fetch("./projects.json", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Project request failed with ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.projects)) {
      throw new Error("Project data was not valid");
    }

    state.projects = payload.projects.filter(isProject);
    renderProjects();
  } catch (error) {
    console.error("Could not load Domus", error);
    renderError();
  }
}

function renderProjects() {
  const query = normalizeSearchValue(state.query);
  const visibleProjects = state.projects
    .filter((project) => {
      if (!query) {
        return true;
      }

      return normalizeSearchValue(`${project.title} ${project.label}`).includes(query);
    })
    .sort((left, right) => titleCollator.compare(left.title, right.title));

  projectList.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (const project of visibleProjects) {
    fragment.append(createProjectRow(project));
  }

  projectList.append(fragment);
  resultCount.textContent = resultCountText(
    visibleProjects.length,
    state.projects.length,
    Boolean(query),
  );

  if (visibleProjects.length === 0) {
    renderEmptyState(Boolean(query));
    return;
  }

  statusMessage.hidden = true;
  projectList.hidden = false;
}

function createProjectRow(project) {
  const item = document.createElement("li");
  item.className = "project-item";

  const link = document.createElement("a");
  link.className = "project-link";
  link.href = project.url;
  link.setAttribute("aria-label", `Open ${project.title}`);

  const details = document.createElement("span");
  details.className = "project-details";

  const title = document.createElement("span");
  title.className = "project-title";
  title.textContent = project.title;

  const label = document.createElement("span");
  label.className = "project-label";
  label.textContent = project.label;

  const action = document.createElement("span");
  action.className = "project-action";

  const actionLabel = document.createElement("span");
  actionLabel.textContent = "Open";

  const actionArrow = document.createElement("span");
  actionArrow.setAttribute("aria-hidden", "true");
  actionArrow.textContent = "→";

  details.append(title, label);
  action.append(actionLabel, actionArrow);
  link.append(details, action);
  item.append(link);
  return item;
}

function renderEmptyState(isSearch) {
  projectList.hidden = true;
  statusMessage.replaceChildren();

  const message = document.createElement("p");
  message.textContent = isSearch
    ? "No projects match this search."
    : "No projects are listed in the house yet.";
  statusMessage.append(message);
  statusMessage.hidden = false;
}

function renderError() {
  projectList.hidden = true;
  resultCount.textContent = "Directory unavailable";
  statusMessage.replaceChildren();

  const message = document.createElement("p");
  message.textContent = "The house could not be opened just now.";

  const retry = document.createElement("button");
  retry.className = "retry-button";
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => {
    void loadProjects();
  });

  statusMessage.append(message, retry);
  statusMessage.hidden = false;
}

function setLoadingState() {
  projectList.hidden = true;
  resultCount.textContent = "Loading projects…";
  statusMessage.replaceChildren();

  const mark = document.createElement("span");
  mark.className = "loading-mark";
  mark.setAttribute("aria-hidden", "true");

  const message = document.createElement("span");
  message.textContent = "Opening the house…";
  statusMessage.append(mark, message);
  statusMessage.hidden = false;
}

function resultCountText(visible, total, isSearch) {
  const noun = visible === 1 ? "place" : "places";
  return isSearch ? `${visible} of ${total} ${noun}` : `${visible} ${noun}`;
}

function normalizeSearchValue(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function updateAddressBar(query) {
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set("q", query);
  } else {
    url.searchParams.delete("q");
  }
  window.history.replaceState(null, "", url);
}

function isProject(value) {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.label === "string" &&
    typeof value.url === "string"
  );
}

function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element;
}
