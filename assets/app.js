(() => {
  "use strict";

  const app = document.querySelector("#app");
  const backButton = document.querySelector("#backButton");
  const pageNav = document.querySelector("#pageNav");
  const previousPage = document.querySelector("#previousPage");
  const nextPage = document.querySelector("#nextPage");
  const pagePosition = document.querySelector("#pagePosition");
  const siteBar = document.querySelector("#siteBar");

  const state = {
    manifest: null,
    chunks: new Map(),
    searchShards: new Map(),
    currentLeaf: null,
  };

  const groupDescriptions = {
    masses: "The Propers, Ordinary, Prefaces, Commons, Votive Masses, and Masses for the Dead.",
    devotions: "Prayers and devotions gathered throughout the original missal.",
    reflections: "Introductions, instructions, feast-day notes, and spiritual reading.",
    reference: "The original contents, glossary, calendars, and complete indices.",
  };

  const groupTitles = {
    masses: "Masses",
    devotions: "Devotions",
    reflections: "Reflections",
    reference: "Reference",
  };

  const preferredGroups = {
    masses: [
      "proper-season",
      "proper-saints",
      "ordinary-mass",
      "prefaces",
      "common-saints",
      "votive-masses",
      "masses-dead",
      "religious-orders",
      "united-states",
    ],
    devotions: [
      "read-mass-with-priest",
      "additional-prayers",
      "occasional-prayers",
      "prayers-dead",
      "forty-hours",
      "general-devotions",
    ],
    reflections: [
      "editors-preface",
      "introduction",
      "meed-of-praise",
      "ordinary-and-proper",
      "ecclesiastical-year",
      "feasts-and-saints",
      "symbolic-representations",
    ],
  };

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value = "") {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function displayTitle(value = "") {
    return value
      .replace(/[Б568B]T(?=[.,\s—-])/g, "ST")
      .replace(/\b(?:PEB|PER|FER|FED)\b/g, "FEB")
      .replace(/\bViGYL\b/gi, "VIGIL")
      .replace(/^\)\s*/, "")
      .replace(/\s+(?:EE\]|[a-z]{1,2})$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isUsefulTitle(title, section) {
    const cleaned = displayTitle(title);
    const key = normalize(cleaned);
    if (!cleaned || key.length < 5) return false;

    if (section?.id === "proper-saints") {
      return /^(vigil|jan|feb|mar|march|apr|may|june|july|aug|sept|oct|nov|dec)\b/.test(key);
    }

    if (section?.id === "proper-season") {
      return /^(jan|feb|mar|march|apr|may|june|july|aug|sept|oct|nov|dec)\b/.test(key)
        || /(sunday|advent|ember|christmas|circumcision|holy name|epiphany|septuagesima|sexagesima|quinquagesima|ash wednesday|lent|passion|palm|holy thursday|good friday|holy saturday|easter|rogation|ascension|pentecost|trinity|corpus christi|sacred heart|christ the king|mass)\b/.test(key);
    }

    return true;
  }

  function titleForPage(page, section) {
    const manifestTitle = Number.isInteger(page?.leaf) ? pageMeta(page.leaf)?.title : "";
    const candidate = page?.title || manifestTitle;
    return isUsefulTitle(candidate, section)
      ? displayTitle(candidate)
      : section?.title || "The New Roman Missal";
  }

  function sectionById(id) {
    return state.manifest.sections.find((section) => section.id === id);
  }

  function pageMeta(leaf) {
    return state.manifest.pages[leaf] || state.manifest.pages.find((page) => page.leaf === leaf);
  }

  function pageLabel(page) {
    return page?.printed ? `Page ${page.printed}` : `Leaf ${Number(page?.leaf || 0) + 1}`;
  }

  function pageRange(section) {
    if (section.printedStart === section.printedEnd) {
      return `Page ${section.printedStart}`;
    }
    return `Pages ${section.printedStart}–${section.printedEnd}`;
  }

  function listRow({ href, title, note = "" }) {
    return `
      <li>
        <a class="list-link" href="${escapeHtml(href)}">
          <span>
            <span class="list-title">${escapeHtml(title)}</span>
            ${note ? `<span class="list-note">${escapeHtml(note)}</span>` : ""}
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </a>
      </li>
    `;
  }

  function heading(kicker, title, description = "") {
    return `
      <header class="screen-heading">
        <p class="page-kicker">${escapeHtml(kicker)}</p>
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </header>
    `;
  }

  function setChrome({ reader = false, home = false } = {}) {
    document.body.classList.toggle("reader-open", reader);
    backButton.hidden = home;
    pageNav.hidden = !reader;
    state.currentLeaf = reader ? state.currentLeaf : null;
  }

  function focusMain() {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }

  function setTitle(title) {
    document.title = title
      ? `${title} · The New Roman Missal`
      : "The New Roman Missal · Sacrum Florilegium";
  }

  function renderHome() {
    setChrome({ home: true });
    setTitle("");
    app.innerHTML = `
      <section class="home" aria-labelledby="homeTitle">
        <header class="home-heading">
          <div class="home-cross" aria-hidden="true">✠</div>
          <p class="eyebrow">Sacrum Florilegium</p>
          <h1 id="homeTitle">The New Roman Missal</h1>
          <p class="home-subtitle">Father Lasance · Latin and English</p>
        </header>
        <nav aria-label="Missal">
          <ul class="plain-list">
            ${listRow({ href: "#/masses", title: "Masses" })}
            ${listRow({ href: "#/devotions", title: "Devotions" })}
            ${listRow({ href: "#/reflections", title: "Reflections" })}
            ${listRow({ href: "#/reference", title: "Reference" })}
            ${listRow({ href: "#/search", title: "Search" })}
          </ul>
        </nav>
      </section>
    `;
  }

  function renderGroup(group) {
    setChrome();
    const title = groupTitles[group];
    setTitle(title);
    const sections = preferredGroups[group]
      .map(sectionById)
      .filter(Boolean);

    app.innerHTML = `
      <section aria-labelledby="groupTitle">
        ${heading("The New Roman Missal", title, groupDescriptions[group])}
        <ul class="plain-list">
          ${sections
            .map((section) =>
              listRow({
                href: `#/section/${section.id}`,
                title: section.title,
                note: pageRange(section),
              }),
            )
            .join("")}
          ${
            group === "masses"
              ? listRow({
                  href: "#/search?section=masses",
                  title: "Find a Mass",
                  note: "Search the Mass sections",
                })
              : ""
          }
        </ul>
      </section>
    `;
  }

  function renderReference() {
    setChrome();
    setTitle("Reference");
    const items = [
      { href: "#/contents", title: "General Contents", note: "The complete original table" },
      { href: "#/section/glossary", title: "Glossary of Liturgical Terms", note: "Pages 1767–1776" },
      { href: "#/section/universal-calendar", title: "Universal Calendar", note: "Pages 1777–1786" },
      { href: "#/section/movable-feasts", title: "Table of Movable Feasts", note: "Page 1839" },
      { href: "#/section/holy-days", title: "Holy Days of Obligation", note: "Page 1840" },
      { href: "#/section/abstinence-fast", title: "Church Law of Abstinence and Fast", note: "Page 1840" },
      { href: "#/section/index", title: "Index of Masses and Prayers", note: "Pages 1842–1852" },
    ];

    app.innerHTML = `
      <section aria-labelledby="referenceTitle">
        ${heading("The New Roman Missal", "Reference", groupDescriptions.reference)}
        <ul class="plain-list">
          ${items.map(listRow).join("")}
        </ul>
        <p class="source-note">
          This is a study transcription of the original printed book. The page number shown
          with every entry follows the missal itself. Because the text was recovered by OCR,
          consult a printed copy when exact wording is important.
        </p>
      </section>
    `;
  }

  function renderContents() {
    setChrome();
    setTitle("General Contents");
    app.innerHTML = `
      <section aria-labelledby="contentsTitle">
        ${heading("Reference", "General Contents", "The complete contents as printed on page 1841.")}
        <ol class="plain-list">
          ${state.manifest.contents
            .map((item) => {
              const section = sectionById(item.id);
              return `
                <li>
                  <a class="contents-row" href="#/section/${escapeHtml(item.id)}">
                    <span>${escapeHtml(item.title)}</span>
                    <span class="contents-page">${escapeHtml(item.page)}</span>
                  </a>
                </li>
              `;
            })
            .join("")}
        </ol>
      </section>
    `;
  }

  function cleanAnchors(section) {
    const seen = new Set();
    const generic = new Set([
      normalize(section.title),
      "proper of the season",
      "proper of the saints",
      "ordinary of the mass",
      "common of saints",
      "general devotions",
      "the new roman missal",
    ]);

    return section.anchors.map((anchor) => ({
      ...anchor,
      title: displayTitle(anchor.title),
    })).filter((anchor) => {
      const title = normalize(anchor.title);
      if (
        title.length < 5
        || generic.has(title)
        || !isUsefulTitle(anchor.title, section)
        || seen.has(`${title}:${anchor.printed}`)
      ) {
        return false;
      }
      seen.add(`${title}:${anchor.printed}`);
      return true;
    });
  }

  function renderSection(id) {
    const section = sectionById(id);
    if (!section) {
      renderNotFound();
      return;
    }

    setChrome();
    setTitle(section.title);
    const anchors = cleanAnchors(section);
    const preview = anchors.slice(0, 48);
    const rest = anchors.slice(48);

    app.innerHTML = `
      <section aria-labelledby="sectionTitle">
        <div class="section-intro">
          ${heading(groupTitles[section.group] || "The New Roman Missal", section.title, pageRange(section))}
          <a class="primary-action" href="#/read/${section.leafStart}">
            <span>Begin reading</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
        ${
          anchors.length
            ? `
              <h2 class="subheading">Within this section</h2>
              <ul class="plain-list anchor-list">
                ${preview
                  .map((anchor) =>
                    listRow({
                      href: `#/read/${anchor.leaf}`,
                      title: anchor.title,
                      note: anchor.printed ? `Page ${anchor.printed}` : "",
                    }),
                  )
                  .join("")}
              </ul>
              ${
                rest.length
                  ? `
                    <ul class="plain-list anchor-list" id="remainingAnchors" hidden>
                      ${rest
                        .map((anchor) =>
                          listRow({
                            href: `#/read/${anchor.leaf}`,
                            title: anchor.title,
                            note: anchor.printed ? `Page ${anchor.printed}` : "",
                          }),
                        )
                        .join("")}
                    </ul>
                    <button class="quiet-button" id="showAllAnchors" type="button">
                      Show all ${anchors.length} entries
                    </button>
                  `
                  : ""
              }
            `
            : ""
        }
        <p>
          <a class="quiet-button" href="#/search?section=${escapeHtml(section.id)}">
            Search within this section
          </a>
        </p>
      </section>
    `;

    const showAll = document.querySelector("#showAllAnchors");
    showAll?.addEventListener("click", () => {
      document.querySelector("#remainingAnchors").hidden = false;
      showAll.remove();
    });
  }

  async function getPage(leaf) {
    const chunkNumber = Math.floor(leaf / state.manifest.book.chunkSize);
    if (!state.chunks.has(chunkNumber)) {
      const response = await fetch(`data/pages/${String(chunkNumber).padStart(3, "0")}.json`);
      if (!response.ok) {
        throw new Error(`The page could not be opened (${response.status}).`);
      }
      state.chunks.set(chunkNumber, await response.json());
    }
    return state.chunks.get(chunkNumber).find((page) => page.leaf === leaf);
  }

  function renderLines(lines) {
    if (!lines?.length) {
      return "";
    }
    return lines
      .map(([text, kind]) => `<p class="ocr-line ${escapeHtml(kind)}">${escapeHtml(text)}</p>`)
      .join("");
  }

  function fullReadingOrder(page) {
    return [...page.lead, ...page.left, ...page.right, ...page.tail];
  }

  async function renderReader(leaf) {
    const parsedLeaf = Number.parseInt(leaf, 10);
    if (!Number.isInteger(parsedLeaf) || parsedLeaf < 0 || parsedLeaf >= state.manifest.book.leafCount) {
      renderNotFound();
      return;
    }

    setChrome({ reader: true });
    state.currentLeaf = parsedLeaf;
    const meta = pageMeta(parsedLeaf);
    const section = sectionById(meta?.section);
    setTitle(titleForPage(meta, section));
    app.innerHTML = `
      <div class="loading-state">
        <span class="small-cross" aria-hidden="true">✠</span>
        <p>Opening ${escapeHtml(pageLabel(meta))}…</p>
      </div>
    `;
    updatePageNav(parsedLeaf, meta);

    try {
      const page = await getPage(parsedLeaf);
      const pageTitle = titleForPage(page, section);
      const parallel = page.mode === "parallel";
      app.innerHTML = `
        <article class="reader" aria-labelledby="readerTitle">
          <header class="reader-heading">
            <p class="page-kicker">${escapeHtml(section?.title || "The New Roman Missal")}</p>
            <h1 id="readerTitle">${escapeHtml(pageTitle)}</h1>
            <p class="reader-page-number">${escapeHtml(pageLabel(page))}</p>
          </header>
          ${
            parallel
              ? `
                ${page.lead.length ? `<div class="spanning-lines">${renderLines(page.lead)}</div>` : ""}
                <div class="parallel-labels" aria-hidden="true">
                  <p class="column-label">Latin</p>
                  <p class="column-label">English</p>
                </div>
                <div class="parallel-text">
                  <section class="text-column" lang="la" aria-label="Latin">
                    ${renderLines(page.left)}
                  </section>
                  <section class="text-column" lang="en" aria-label="English">
                    ${renderLines(page.right)}
                  </section>
                </div>
                ${page.tail.length ? `<div class="tail-lines">${renderLines(page.tail)}</div>` : ""}
              `
              : `
                <section class="single-text">
                  ${renderLines(fullReadingOrder(page))}
                </section>
              `
          }
          <p class="scan-note">OCR transcription · punctuation and line breaks follow the source scan.</p>
        </article>
      `;
      prefetchNeighbor(parsedLeaf + 1);
    } catch (error) {
      app.innerHTML = `
        <section class="error-state">
          <h1>This page could not be opened</h1>
          <p>${escapeHtml(error.message)}</p>
        </section>
      `;
    }
  }

  function updatePageNav(leaf, meta) {
    previousPage.disabled = leaf <= 0;
    nextPage.disabled = leaf >= state.manifest.book.leafCount - 1;
    pagePosition.textContent = meta?.printed ? `p. ${meta.printed}` : `${leaf + 1} / ${state.manifest.book.leafCount}`;
    previousPage.onclick = () => {
      if (leaf > 0) location.hash = `#/read/${leaf - 1}`;
    };
    nextPage.onclick = () => {
      if (leaf < state.manifest.book.leafCount - 1) location.hash = `#/read/${leaf + 1}`;
    };
  }

  function prefetchNeighbor(leaf) {
    if (leaf < 0 || leaf >= state.manifest.book.leafCount) return;
    const chunkNumber = Math.floor(leaf / state.manifest.book.chunkSize);
    if (state.chunks.has(chunkNumber)) return;
    fetch(`data/pages/${String(chunkNumber).padStart(3, "0")}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((chunk) => {
        if (chunk) state.chunks.set(chunkNumber, chunk);
      })
      .catch(() => {});
  }

  function searchScope(sectionParam) {
    if (!sectionParam) return { title: "Search", sectionIds: null };
    if (sectionParam === "masses") {
      return { title: "Find a Mass", sectionIds: new Set(preferredGroups.masses) };
    }
    const section = sectionById(sectionParam);
    return {
      title: section ? `Search ${section.title}` : "Search",
      sectionIds: section ? new Set([section.id]) : null,
    };
  }

  async function loadSearchShard(key) {
    if (!state.searchShards.has(key)) {
      const response = await fetch(`data/search/${key}.json`);
      state.searchShards.set(key, response.ok ? await response.json() : {});
    }
    return state.searchShards.get(key);
  }

  function intersection(lists) {
    if (!lists.length) return [];
    const ordered = [...lists].sort((a, b) => a.length - b.length);
    return ordered[0].filter((leaf) => ordered.slice(1).every((list) => list.includes(leaf)));
  }

  async function findLeaves(query, allowedSections) {
    const terms = [...new Set(normalize(query).split(" ").filter((term) => term.length >= 3))];
    if (!terms.length) return [];

    const lists = [];
    for (const term of terms) {
      const key = /^[a-z]/.test(term) ? term[0] : "_";
      const shard = await loadSearchShard(key);
      let leaves = shard[term] || [];
      if (!leaves.length && term.length >= 4) {
        const variants = Object.keys(shard)
          .filter((token) => token.startsWith(term))
          .slice(0, 40);
        leaves = [...new Set(variants.flatMap((token) => shard[token]))].sort((a, b) => a - b);
      }
      lists.push(leaves);
    }

    let leaves = intersection(lists);
    if (!leaves.length) {
      leaves = [...new Set(lists.flat())].sort((a, b) => a - b);
    }
    if (allowedSections) {
      leaves = leaves.filter((leaf) => allowedSections.has(pageMeta(leaf)?.section));
    }
    return leaves.slice(0, 60);
  }

  function highlightedSnippet(text, query) {
    const terms = normalize(query).split(" ").filter((term) => term.length >= 3);
    const lowered = text.toLowerCase();
    let index = -1;
    for (const term of terms) {
      index = lowered.indexOf(term);
      if (index >= 0) break;
    }
    const start = Math.max(0, index >= 0 ? index - 72 : 0);
    const snippet = `${start > 0 ? "…" : ""}${text.slice(start, start + 235)}${text.length > start + 235 ? "…" : ""}`;
    let safe = escapeHtml(snippet);
    for (const term of terms) {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safe = safe.replace(new RegExp(`(${escapedTerm})`, "gi"), "<mark>$1</mark>");
    }
    return safe;
  }

  async function executeSearch(query, scope) {
    const status = document.querySelector("#searchStatus");
    const results = document.querySelector("#searchResults");
    status.textContent = "Searching the missal…";
    results.innerHTML = "";

    const leaves = await findLeaves(query, scope.sectionIds);
    if (!leaves.length) {
      status.textContent = "No pages found. Try a saint’s surname, a feast, or a distinctive phrase.";
      return;
    }

    const pages = await Promise.all(leaves.map(getPage));
    status.textContent = `${pages.length}${pages.length === 60 ? "+" : ""} page${pages.length === 1 ? "" : "s"} found`;
    results.innerHTML = pages
      .map((page) => {
        const section = sectionById(page.section);
        return listRow({
          href: `#/read/${page.leaf}`,
          title: titleForPage(page, section),
          note: `${section?.title || "The New Roman Missal"} · ${pageLabel(page)}`,
        }).replace(
          "</span>\n          <span class=\"chevron\"",
          `<span class="result-snippet">${highlightedSnippet(page.text, query)}</span></span>
          <span class="chevron"`,
        );
      })
      .join("");
  }

  function renderSearch(params) {
    setChrome();
    const scope = searchScope(params.get("section"));
    const initialQuery = params.get("q") || "";
    setTitle(scope.title);
    app.innerHTML = `
      <section aria-labelledby="searchTitle">
        ${heading("The New Roman Missal", scope.title, "Search every prayer, feast, devotion, reflection, glossary entry, and index.")}
        <form class="search-form" id="searchForm">
          <label class="field-label" for="searchInput">Words or phrase</label>
          <div class="search-box">
            <input
              id="searchInput"
              name="q"
              type="search"
              value="${escapeHtml(initialQuery)}"
              placeholder="e.g. Immaculate Conception"
              autocomplete="off"
            />
            <button type="submit">Search</button>
          </div>
          <div class="page-jump">
            <input
              id="pageInput"
              type="number"
              inputmode="numeric"
              min="1"
              max="1852"
              placeholder="Printed page"
              aria-label="Printed page number"
            />
            <button id="pageJumpButton" type="button">Go to page</button>
          </div>
        </form>
        <p class="status-copy" id="searchStatus" aria-live="polite">
          Enter a feast, prayer, name, or phrase.
        </p>
        <ul class="plain-list" id="searchResults"></ul>
      </section>
    `;

    const form = document.querySelector("#searchForm");
    const input = document.querySelector("#searchInput");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query) return;
      executeSearch(query, scope);
    });

    document.querySelector("#pageJumpButton").addEventListener("click", () => {
      const printed = document.querySelector("#pageInput").value.trim();
      const leaf = state.manifest.printedToLeaf[printed];
      if (Number.isInteger(leaf)) {
        location.hash = `#/read/${leaf}`;
      } else {
        document.querySelector("#searchStatus").textContent = "That printed page was not found.";
      }
    });

    if (initialQuery) {
      executeSearch(initialQuery, scope);
    }
  }

  function renderNotFound() {
    setChrome();
    setTitle("Not Found");
    app.innerHTML = `
      <section class="empty-state">
        <h1>That place was not found</h1>
        <p><a class="quiet-button" href="#/">Return to the missal</a></p>
      </section>
    `;
  }

  function parseRoute() {
    const raw = location.hash.slice(1) || "/";
    const [pathname, query = ""] = raw.split("?");
    return {
      parts: pathname.split("/").filter(Boolean),
      params: new URLSearchParams(query),
    };
  }

  async function route() {
    if (!state.manifest) return;
    const { parts, params } = parseRoute();
    const [name, value] = parts;

    if (!name) renderHome();
    else if (["masses", "devotions", "reflections"].includes(name)) renderGroup(name);
    else if (name === "reference") renderReference();
    else if (name === "contents") renderContents();
    else if (name === "section" && value) renderSection(value);
    else if (name === "read" && value !== undefined) await renderReader(value);
    else if (name === "search") renderSearch(params);
    else renderNotFound();

    focusMain();
  }

  async function start() {
    try {
      const response = await fetch("data/manifest.json");
      if (!response.ok) throw new Error(`Book data returned ${response.status}.`);
      state.manifest = await response.json();
      await route();
    } catch (error) {
      app.innerHTML = `
        <section class="error-state">
          <h1>The missal could not be opened</h1>
          <p>${escapeHtml(error.message)}</p>
        </section>
      `;
    }
  }

  backButton.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.hash = "#/";
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", () => {
    siteBar.classList.toggle("is-scrolled", window.scrollY > 8);
  }, { passive: true });

  start();
})();
