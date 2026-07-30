#!/usr/bin/env python3
"""Integrity checks for the generated static missal."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    manifest = read_json(DATA / "manifest.json")
    expected_count = manifest["book"]["leafCount"]
    chunk_size = manifest["book"]["chunkSize"]
    pages = []

    for chunk_path in sorted((DATA / "pages").glob("*.json")):
        chunk = read_json(chunk_path)
        assert 0 < len(chunk) <= chunk_size, f"Invalid chunk size: {chunk_path}"
        pages.extend(chunk)

    leaves = [page["leaf"] for page in pages]
    assert len(pages) == expected_count == 1877, "The book must contain all 1,877 leaves."
    assert leaves == list(range(expected_count)), "Leaves are missing or out of order."
    assert len(manifest["pages"]) == expected_count, "Manifest page metadata is incomplete."
    assert sum(bool(page["text"]) for page in pages) > 1850, "Too many pages have no OCR text."

    section_ids = {section["id"] for section in manifest["sections"]}
    assert all(page["section"] in section_ids or page["section"] == "front-matter" for page in pages)
    assert all(section["leafStart"] <= section["leafEnd"] for section in manifest["sections"])

    pages_by_leaf = {page["leaf"]: page for page in pages}
    assert pages_by_leaf[847]["mode"] == "parallel", "Mass Latin and English columns were lost."
    for leaf in (1858, 1859, 1860, 1861, 1862):
        assert pages_by_leaf[leaf]["mode"] == "parallel", f"Bilingual devotion leaf {leaf} is not parallel."

    immaculate = set(read_json(DATA / "search" / "i.json")["immaculate"])
    conception = set(read_json(DATA / "search" / "c.json")["conception"])
    assert 846 in immaculate & conception, "The Immaculate Conception is not searchable."
    saints = next(section for section in manifest["sections"] if section["id"] == "proper-saints")
    immaculate_anchor = next(
        anchor for anchor in saints["anchors"] if anchor["title"] == "DEC. 8—IMMACULATE CONCEPTION"
    )
    assert immaculate_anchor["leaf"] == 847, "The feast must open on its first text-bearing page."
    assert manifest["pages"][847]["title"], "The feast title must carry into its first text-bearing page."

    devotions = next(section for section in manifest["sections"] if section["id"] == "general-devotions")
    devotion_titles = {anchor["title"] for anchor in devotions["anchors"]}
    for required in (
        "Morning Prayers",
        "Evening Prayers",
        "The Memorare",
        "The Stations of the Cross",
        "Benediction of the Blessed Sacrament",
    ):
        assert required in devotion_titles, f"Missing devotion: {required}"

    maximum_asset = max(
        (path.stat().st_size, path)
        for path in ROOT.rglob("*")
        if path.is_file() and ".git" not in path.parts
    )
    assert maximum_asset[0] < 25 * 1024 * 1024, f"Asset is too large for static hosting: {maximum_asset[1]}"

    print(
        f"Validated {expected_count} pages, {len(manifest['sections'])} sections, "
        f"and {len(list((DATA / 'search').glob('*.json')))} search shards."
    )


if __name__ == "__main__":
    main()
