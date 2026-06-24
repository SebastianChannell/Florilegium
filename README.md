# Florilegium

Florilegium is a quiet, dark-themed personal quote library for Catholic passages drawn from Holy Scripture, saints, Church Fathers, and devotional writers.

## Files

- `index.html` — the page structure and content.
- `styles.css` — the warm, ink-dark visual design.
- `app.js` — the client-side search and filter behavior.
- `quotes.json` — the collection of quote entries.
- `README.md` — this guide.

## How to use

Open the site locally with a simple static server:

```bash
python3 -m http.server 3000
```

Then visit `http://localhost:3000` in your browser.

## Adding quotes

Edit `quotes.json` and add a new object to the array. Each entry should use this structure:

```json
{
  "text": "Your quote here.",
  "author": "Author Name",
  "source": "Book, letter, or phrase",
  "page": "",
  "tags": ["Tag1", "Tag2"]
}
```

- `text` is the quote itself.
- `author` is the speaker or source.
- `source` is the work, translation, or context.
- `page` is optional and may be left empty.
- `tags` should be an array of descriptive keywords.

After saving `quotes.json`, refresh the page to load the updated quotes.

## Deploying to Netlify

1. Push the repository to a Git host such as GitHub.
2. In Netlify, create a new site and connect it to the repository.
3. Use the default deploy settings.
4. Since this is a static site with no build step, Netlify will serve the files directly.

No build command is needed.

## Notes

The site is intentionally mobile-first, warm-toned, and meant to feel like a small devotional treasury rather than a bright, modern interface.
