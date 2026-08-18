# Domus — Sacrum Florilegium

A quiet, mobile-first home for the Sacrum Florilegium projects. The interface
follows the compact list, typography, and palette of Librarium while keeping the
individual destinations in one small data file.

## Add or change a project

Edit [`projects.json`](./projects.json). Each destination is one object:

```json
{
  "id": "new-project",
  "title": "New Project",
  "label": "Short Description",
  "url": "https://new-project.sacrumflorilegium.com/"
}
```

Domus sorts every project alphabetically by title, so a new object may be added
anywhere in the array. No HTML, CSS, or JavaScript changes are needed.

## Local preview

```sh
npm run serve
```

Then open `http://localhost:4173`.

## Validation

```sh
npm run check
```

The check verifies the browser JavaScript and every required project field,
identifier, and HTTPS link.
