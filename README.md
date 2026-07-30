# Sacrum Florilegium — The New Roman Missal

A quiet, mobile-first website for private study of *The New Roman Missal in
Latin and English* by Rev. F. X. Lasance.

The interface deliberately keeps one task on screen at a time:

- Mass propers and the Ordinary in parallel Latin and English columns
- devotions and spiritual reading in a calm single-column reader
- the complete original table of contents
- the complete glossary, calendars, and indices
- full-text search and printed-page lookup

The site is static and requires no framework, database, or server-side code.

## Local preview

```sh
npm run serve
```

Then open `http://localhost:4173`.

## Rebuild the book data

The generated `data/` directory comes from the hOCR and page-number derivatives
of the source scan:

```sh
python3 scripts/ingest_missal.py \
  --hocr "/path/to/New Roman Missal Lasance25_hocr.html" \
  --page-numbers "/path/to/New Roman Missal Lasance25_page_numbers.json" \
  --out data
```

The parser preserves the printed page layout. Within Mass sections, the left
column is presented as Latin and the right as English. OCR is never a substitute
for the original printed page and may contain transcription errors.

