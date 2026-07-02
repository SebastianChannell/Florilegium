# Missal Propers Generator

This project should not call Divinum Officium from the deployed website. Instead, generate the Mass propers ahead of time and commit the resulting JSON.

## Recommended iPhone-friendly workflow

Use the GitHub Action added at:

```text
.github/workflows/generate-missal-propers.yml
```

From GitHub on your phone:

1. Open the repository.
2. Go to **Actions**.
3. Choose **Generate Missal Propers**.
4. Tap **Run workflow**.
5. Select the branch you want to update, usually `feature/devotions` while developing.
6. Run it.

The workflow temporarily clones Divinum Officium inside GitHub Actions, runs the generator, and commits the generated JSON back to the selected branch. You do not need a local Divinum Officium clone on your phone or computer.

## Optional local workflow

If you ever do want to run it locally, clone Divinum Officium next to this repository or somewhere else on your machine:

```bash
git clone https://github.com/DivinumOfficium/divinum-officium.git ../divinum-officium
```

Then run the generator from the Sacrum Florilegium repository:

```bash
DIVINUM_OFFICIUM_PATH=../divinum-officium npm run build:missal-propers
```

## What it does

The generator runs the Divinum Officium Missa CGI script with `Propers=1`, `Rubrics 1960 - 1960`, and English output. It parses the rendered proper Mass sections and writes them to:

```text
data/missal/1962/propers-en.json
data/missal/1962/proper-map-2026.generated.json
```

The live site reads only the committed JSON files. It does not call Divinum Officium, GitHub raw files, or any other external proper source at runtime.

## Adding more days

Add entries to:

```text
tools/missal-propers-source-list.json
```

Each entry needs a stable `properId`, a display `title`, the Divinum Officium source `path`, and one or more `mapDates`.

If a repeated Sunday proper is used for multiple weekdays, add all those dates to `mapDates`.

## Notes

This generator intentionally uses rendered Divinum Officium output instead of trying to merge raw data files. Divinum Officium is a rules engine as well as a text source, so rendering first avoids many fragile edge cases around commons, commemorations, and Gospel text expansion.
