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

The bridge is `proper-map-2026.json`. It supports two forms.

A simple local proper ID:

```json
{
  "days": {
    "2026-07-01": "sancti-07-01"
  }
}
```

Or a mapped Divinum Officium source path:

```json
{
  "days": {
    "2026-07-05": {
      "properId": "tempora-pent06-0",
      "title": "Sixth Sunday after Pentecost",
      "sourcePath": "Tempora/Pent06-0.txt"
    }
  }
}
```

The provider first looks in `propers-en.json`. If the proper is not yet materialized there, it can fetch the mapped Divinum Officium source file and parse it dynamically. This lets the site become useful immediately while the local static library grows.

## Current state

The branch includes a manually materialized seed for:

- `2026-07-01` → The Most Precious Blood of Our Lord Jesus Christ

The branch also includes July 2026 mappings for many days whose propers can be pulled from either `Tempora/` or full/partial `Sancti/` files. The strongest current coverage is:

- July Sundays and ferias using the preceding Sunday Mass where the Ordo calls for it.
- July 1, July 3, July 20, July 22, July 23, and July 28 with fuller proper data.
- Several other fixed days have partial proper files because Divinum Officium expects a Common to supply the rest.

## Common Mass caveat

Many saints’ days in Divinum Officium only provide the proper collect or a few special parts, because the rest of the Mass comes from a Common. Example: a saint may use `Mass In medio` or `Mass Os iusti` with only a proper collect.

The next needed improvement is a **Common resolver**:

- Detect common-mass notes from the Romanitas Ordo entry, such as `Mass Os iusti`, `Mass In medio`, or `Mass Statuit`.
- Map those to the correct Divinum Officium `Commune/` source file.
- Merge Common sections with the proper `Sancti/` sections, letting the proper collect override the Common collect.

## Adding more propers

Add one item at a time to `tools/missal-propers-source-list.json`:

```json
{
  "properId": "tempora-pent06-0",
  "title": "Sixth Sunday after Pentecost",
  "path": "Tempora/Pent06-0.txt",
  "mapDates": ["2026-07-05", "2026-07-06", "2026-07-09"]
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
