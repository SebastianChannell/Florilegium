# 1962 Missal propers ingestion

The site now has a stable place for Mass propers:

- `data/missal/1962/propers-en.json`
- `data/missal/1962/proper-map-2026.json`
- `js/missalPropersProvider.js`

## Source

Use the Divinum Officium repository as the source for Missal texts:

- Repository: `https://github.com/DivinumOfficium/divinum-officium`
- Mass data: `web/www/missa/`
- English Mass data: `web/www/missa/English/`
- Latin Mass data: `web/www/missa/Latin/`

The folders inside `missa/English/` and `missa/Latin/` are the important ones:

- `Tempora/` — seasons, Sundays, ferias, vigils, etc.
- `Sancti/` — fixed saints and fixed feasts by month/day.
- `Commune/` — commons of saints.
- `Ordo/` — ordinary/order material.

Divinum Officium files are divided into bracketed sections. The ones most useful for the site are:

- `[Introitus]` → Introit
- `[Oratio]` → Collect
- `[Lectio]` → Epistle / Lesson
- `[Graduale]` → Gradual
- `[GradualeP]` → Alleluia / Paschal gradual variant
- `[Tractus]` → Tract
- `[Evangelium]` → Gospel
- `[Offertorium]` → Offertory
- `[Secreta]` → Secret
- `[Communio]` → Communion
- `[Postcommunio]` → Postcommunion

## How the site uses this

The Romanitas Ordo answers: **what Mass is said today?**

The Missal propers answer: **what are the texts of that Mass?**

The bridge is `proper-map-2026.json`:

```json
{
  "days": {
    "2026-07-01": "sancti-07-01"
  }
}
```

That points a date to a reusable proper in `propers-en.json`:

```json
{
  "propers": {
    "sancti-07-01": {
      "title": "The Most Precious Blood of Our Lord Jesus Christ",
      "sections": {
        "epistle": {},
        "gospel": {}
      }
    }
  }
}
```

## Current seed

The branch currently includes a first working seed for:

- `2026-07-01` → The Most Precious Blood of Our Lord Jesus Christ

This proves the full path from:

`Ordo date → proper ID → Introit/Collect/Epistle/Gospel/etc. → readings page`

## Adding more propers

Add one item at a time to `tools/missal-propers-source-list.json`:

```json
{
  "properId": "sancti-07-01",
  "title": "The Most Precious Blood of Our Lord Jesus Christ",
  "path": "Sancti/07-01.txt",
  "mapDates": ["2026-07-01"]
}
```

Then run locally:

```bash
node tools/build-missal-propers.mjs
```

The script writes generated files:

- `data/missal/1962/propers-en.generated.json`
- `data/missal/1962/proper-map-2026.generated.json`

Review the generated files. If they look good, copy/rename them over:

- `propers-en.generated.json` → `propers-en.json`
- `proper-map-2026.generated.json` → `proper-map-2026.json`

## Practical order for building the library

1. Sundays and I/II class feasts.
2. Major fixed feasts from `Sancti/`.
3. Commons from `Commune/`.
4. Ferias and seasonal days from `Tempora/`.
5. Optional/votive/festal Masses.

This keeps the site useful quickly while still letting the proper library grow gradually.
