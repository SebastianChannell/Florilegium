#!/usr/bin/env python3
"""Convert the Internet Archive hOCR derivative into static reader data."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

from lxml import etree


CHUNK_SIZE = 20
FORCE_PARALLEL = {1859}
BBOX_RE = re.compile(r"\bbbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)")
FSIZE_RE = re.compile(r"\b(?:x_fsize|x_size)\s+([0-9.]+)")
WORD_RE = re.compile(r"[a-z0-9]+")

TOC = [
    ("editors-preface", "Editors’ Preface", 5, 7, "reflections", "full"),
    ("introduction", "Introduction", 8, 41, "reflections", "full"),
    ("meed-of-praise", "A Meed of Praise", 42, 42, "reflections", "full"),
    ("read-mass-with-priest", "Read Mass with the Priest", 43, 72, "devotions", "full"),
    ("ordinary-and-proper", "The Ordinary and Proper Parts of the Mass", 73, 102, "reflections", "full"),
    ("proper-season", "Proper of the Season", 103, 752, "masses", "parallel"),
    ("ordinary-mass", "Ordinary of the Mass", 753, 797, "masses", "parallel"),
    ("prefaces", "Prefaces of the Mass", 798, 819, "masses", "parallel"),
    ("additional-prayers", "Additional Prayers", 820, 829, "devotions", "full"),
    ("proper-saints", "Proper of the Saints", 830, 1298, "masses", "parallel"),
    ("common-saints", "Common of the Saints", 1299, 1409, "masses", "parallel"),
    ("votive-masses", "Votive Masses", 1410, 1493, "masses", "parallel"),
    ("occasional-prayers", "Occasional Prayers", 1494, 1500, "devotions", "full"),
    ("masses-dead", "Masses for the Dead", 1501, 1509, "masses", "parallel"),
    ("prayers-dead", "Various Prayers for the Dead", 1510, 1534, "devotions", "full"),
    ("forty-hours", "Forty Hours’ Devotion", 1535, 1545, "devotions", "full"),
    ("religious-orders", "Masses for Religious Orders", 1546, 1575, "masses", "parallel"),
    ("united-states", "Masses Proper to the United States", 1576, 1621, "masses", "parallel"),
    ("ecclesiastical-year", "The Ecclesiastical Year and Sacred Liturgy", 1622, 1674, "reflections", "full"),
    ("feasts-and-saints", "Short Accounts of Certain Feasts and Lives of Saints", 1675, 1764, "reflections", "full"),
    ("symbolic-representations", "Descriptions of Symbolic Representations", 1765, 1766, "reflections", "full"),
    ("glossary", "Glossary of Liturgical Terms", 1767, 1776, "reference", "full"),
    ("universal-calendar", "Universal Calendar", 1777, 1786, "reference", "full"),
    ("general-devotions", "General Devotions", 1787, 1838, "devotions", "full"),
    ("movable-feasts", "Table of Movable Feasts", 1839, 1839, "reference", "full"),
    ("holy-days", "Holy Days of Obligation", 1840, 1840, "reference", "full"),
    ("abstinence-fast", "Church Law of Abstinence and Fast", 1840, 1840, "reference", "full"),
    ("general-contents", "General Contents", 1841, 1841, "reference", "full"),
    ("index", "Index of Masses and Prayers", 1842, 1852, "reference", "full"),
]

CURATED_ANCHORS = {
    "general-devotions": [
        (1811, "Morning Prayers"),
        (1814, "Evening Prayers"),
        (1817, "Devotions for Confession"),
        (1821, "Act of Contrition"),
        (1823, "Devotions Before and After Mass and Communion"),
        (1833, "Prayer to St. Joseph"),
        (1837, "Adoro Te Devote"),
        (1838, "Anima Christi"),
        (1840, "Acts of Faith, Adoration, Hope, Love, and Consecration"),
        (1844, "Litany of the Holy Name of Jesus"),
        (1846, "Litany of the Sacred Heart"),
        (1847, "Litany of the Blessed Virgin Mary"),
        (1848, "The Memorare"),
        (1850, "Prayer to St. Joseph, Patron of the Universal Church"),
        (1853, "The Mysteries of the Holy Rosary"),
        (1855, "The Stations of the Cross"),
        (1857, "Benediction of the Blessed Sacrament"),
        (1860, "Te Deum"),
    ],
}

STOP_WORDS = {
    "and", "are", "but", "for", "from", "has", "have", "his", "not", "our",
    "that", "the", "their", "there", "these", "this", "those", "was", "were",
    "will", "with", "you", "your", "after", "before", "into", "upon", "which",
    "who", "whom", "whose", "would", "shall", "should", "may", "might", "can",
    "could", "all", "any", "each", "more", "most", "other", "some", "such",
    "than", "then", "very", "what", "when", "where", "while", "also",
    "amen", "domine", "dominus", "deus", "per", "qui", "quia", "cum", "est",
    "et", "in", "ad", "a", "ab", "ex", "de", "ut", "non", "nos", "te",
    "tibi", "tu", "tua", "tuam", "tuum", "eius", "eum", "hoc", "haec",
}

RUBRIC_STARTS = (
    "the priest", "the celebrant", "the server", "the ministers", "the choir",
    "here ", "then ", "all ", "at the ", "standing", "kneeling", "sitting",
    "bowing", "while ", "when ", "after ", "before ", "oratio", "rubric",
)

LATIN_SIGNALS = {
    "adoramus", "amen", "benedictio", "christum", "deum", "deus", "domine",
    "domino", "dominum", "dominus", "et", "filium", "gloria", "laudamus",
    "nobis", "noster", "oremus", "patri", "per", "qui", "sanctissimum",
    "sancto", "spiritui", "te", "tibi",
}

ENGLISH_SIGNALS = {
    "and", "art", "be", "blessed", "father", "from", "god", "heaven",
    "holy", "lord", "may", "our", "the", "thee", "thou", "thy", "us",
    "we", "who", "with",
}


def parse_bbox(value: str | None) -> tuple[int, int, int, int] | None:
    match = BBOX_RE.search(value or "")
    return tuple(map(int, match.groups())) if match else None


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_token(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    return "".join(char for char in folded if not unicodedata.combining(char)).lower()


def looks_like_title_case(text: str) -> bool:
    words = re.findall(r"[A-Za-zÀ-ÿ]+", text)
    if not 1 < len(words) <= 11:
        return False
    significant = [word for word in words if len(word) > 2]
    if not significant:
        return False
    titled = sum(word[0].isupper() for word in significant)
    return titled / len(significant) >= 0.58


def classify_line(text: str, font_size: float = 0) -> str:
    letters = "".join(char for char in text if char.isalpha())
    if letters and len(letters) >= 4 and letters.isupper():
        return "heading"
    if font_size >= 23 and len(text) <= 76 and looks_like_title_case(text):
        return "heading"
    lowered = text.lower().lstrip("([*†‡ ")
    if lowered.startswith(RUBRIC_STARTS) or (text.startswith("(") and text.endswith(")")):
        return "rubric"
    return "body"


def line_payload(item: dict) -> list[str]:
    text = normalize_space(item["text"])
    return [text, classify_line(text, float(item.get("font", 0)))]


def page_number_map(path: Path) -> tuple[dict[int, str], dict[int, int]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    leaf_to_printed: dict[int, str] = {}
    printed_to_leaf: dict[int, int] = {}
    for entry in raw["pages"]:
        leaf = int(entry["leafNum"])
        printed = str(entry.get("pageNumber") or "").strip()
        leaf_to_printed[leaf] = printed
        if printed.isdigit():
            printed_to_leaf.setdefault(int(printed), leaf)

    # The first numbered leaves are omitted from the derivative's page map.
    # In this edition they run continuously two leaves behind the printed number.
    for printed in range(5, 42):
        printed_to_leaf.setdefault(printed, printed - 2)

    # Fill occasional OCR omissions by continuing from the nearest recognized
    # printed page. Existing high-confidence mappings always win.
    recognized = sorted(printed_to_leaf)
    for printed in range(5, 1853):
        if printed in printed_to_leaf:
            continue
        nearest = min(recognized, key=lambda value: abs(value - printed))
        printed_to_leaf[printed] = printed_to_leaf[nearest] + (printed - nearest)
    return leaf_to_printed, printed_to_leaf


def make_sections(printed_to_leaf: dict[int, int]) -> list[dict]:
    sections = []
    for section_id, title, start, end, group, mode in TOC:
        leaf_start = printed_to_leaf[start]
        leaf_end = printed_to_leaf[end]
        sections.append(
            {
                "id": section_id,
                "title": title,
                "printedStart": start,
                "printedEnd": end,
                "leafStart": leaf_start,
                "leafEnd": leaf_end,
                "group": group,
                "mode": mode,
                "anchors": [],
            }
        )
    return sections


def section_for_leaf(leaf: int, sections: list[dict]) -> dict:
    matches = [section for section in sections if section["leafStart"] <= leaf <= section["leafEnd"]]
    if matches:
        return matches[0]
    return {
        "id": "front-matter",
        "title": "Front Matter",
        "group": "reference",
        "mode": "full",
    }


def words_for_line(line) -> list[dict]:
    words = []
    for element in line.iter("span"):
        classes = (element.get("class") or "").split()
        if "ocrx_word" not in classes:
            continue
        text = normalize_space("".join(element.itertext()))
        bbox = parse_bbox(element.get("title"))
        if not text or not bbox:
            continue
        words.append(
            {
                "text": text,
                "x1": bbox[0],
                "y1": bbox[1],
                "x2": bbox[2],
                "y2": bbox[3],
            }
        )
    words.sort(key=lambda item: item["x1"])
    return words


def parallel_orientation(left: list[dict], right: list[dict]) -> str | None:
    if len(left) < 7 or len(right) < 7:
        return None
    left_tokens = WORD_RE.findall(normalize_token(" ".join(item["text"] for item in left)))
    right_tokens = WORD_RE.findall(normalize_token(" ".join(item["text"] for item in right)))
    left_latin = sum(token in LATIN_SIGNALS for token in left_tokens)
    left_english = sum(token in ENGLISH_SIGNALS for token in left_tokens)
    right_latin = sum(token in LATIN_SIGNALS for token in right_tokens)
    right_english = sum(token in ENGLISH_SIGNALS for token in right_tokens)
    if left_latin >= 7 and left_latin > left_english * 1.25 and right_english >= 7:
        return "normal"
    if right_latin >= 7 and right_latin > right_english * 1.25 and left_english >= 7:
        return "swap"
    return None


def clean_title(value: str) -> str:
    value = value.translate(
        str.maketrans(
            {
                "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H",
                "І": "I", "К": "K", "М": "M", "О": "O", "Р": "P",
                "Т": "T", "Х": "X",
                "а": "a", "с": "c", "е": "e", "і": "i", "о": "o",
                "р": "p", "х": "x", "в": "b", "н": "h", "м": "m",
                "п": "n", "т": "t", "у": "y", "г": "r", "л": "l",
            }
        )
    )
    value = normalize_space(value).strip("“”‘’'\".,;:·•—–- ")
    value = re.sub(r"^[\d%]+(?:\s+|(?=[A-Z]))", "", value)
    value = re.sub(r"^[A-Z]\d+\s+", "", value)
    value = re.sub(r"^[a-z]{1,3}\s+(?=[A-Z])", "", value)
    value = re.sub(r"\s+[\d%]+$", "", value)
    value = re.sub(r"\s+[a-z]{1,3}$", "", value)
    value = re.sub(r"\b8T\.", "ST.", value)
    value = re.sub(r"\bOP\b", "OF", value)
    value = value.replace("WEEE", "WEEK").replace("ADVERT", "ADVENT").replace("VIGYL", "VIGIL")
    value = value.replace("DEO.", "DEC.")
    return normalize_space(value)


def title_key(value: str) -> str:
    return re.sub(r"[^a-z]+", " ", normalize_token(value)).strip()


def plausible_title(value: str, section: dict) -> bool:
    if not value or len(value) < 5:
        return False
    letters = [char for char in value if char.isalpha()]
    if not letters:
        return False
    latin_letters = 0
    for char in letters:
        try:
            if "LATIN" in unicodedata.name(char):
                latin_letters += 1
        except ValueError:
            pass
    if latin_letters / len(letters) < 0.82:
        return False

    words = re.findall(r"[A-Za-zÀ-ÿ]+", value)
    if len([word for word in words if len(word) == 1]) > 2:
        return False
    lowered = title_key(value)
    if not lowered or "concluding prayers page" in lowered or "offertory prayers page" in lowered:
        return False
    if lowered.split(" ", 1)[0] in {"and", "but", "for", "that", "then", "which", "who"}:
        return False
    section_key = title_key(section["title"])
    if SequenceMatcher(None, lowered, section_key).ratio() > 0.76:
        return False

    if section["group"] == "masses":
        upper_ratio = sum(char.isupper() for char in letters) / len(letters)
        month_heading = re.match(
            r"^(jan|feb|mar|apr|may|june|july|aug|sept|oct|nov|dec)\\b",
            lowered,
        )
        if upper_ratio < 0.58 and not month_heading:
            return False
    return True


def choose_title(lines: list[dict], page_width: int, page_height: int, section_title: str) -> str:
    candidates = []
    normalized_section = re.sub(r"[^a-z]+", " ", normalize_token(section_title)).strip()
    for line in lines:
        text = clean_title(line["text"])
        letters = "".join(char for char in text if char.isalpha())
        if len(letters) < 5 or len(text) > 105 or line["y"] > page_height * 0.38:
            continue
        upper_ratio = sum(char.isupper() for char in letters) / len(letters)
        line_width = line["x2"] - line["x"]
        line_center = line["x"] + line_width / 2
        centered_title_case = (
            line["font"] >= 19
            and looks_like_title_case(text)
            and line_width < page_width * 0.72
            and abs(line_center - page_width / 2) < page_width * 0.2
        )
        if upper_ratio < 0.72 and not centered_title_case:
            continue
        if re.fullmatch(r"[\dIVXLCDM .-]+", text):
            continue
        score = (line["font"] * 3) + min(len(letters), 42)
        if upper_ratio >= 0.72:
            score += 55
        score += max(0, (page_height * 0.38 - line["y"]) / 18)
        normalized_title = re.sub(r"[^a-z]+", " ", normalize_token(text)).strip()
        if (
            normalized_title == normalized_section
            or "the new roman missal" in normalized_title
            or "general devotion" in normalized_title
        ):
            continue
        candidates.append((score, text))
    return max(candidates, default=(0, ""))[1]


def process_page(element, leaf_to_printed: dict[int, str], sections: list[dict]) -> dict:
    page_id = element.get("id") or "page_000000"
    leaf = int(page_id.rsplit("_", 1)[-1])
    page_bbox = parse_bbox(element.get("title")) or (0, 0, 576, 936)
    width = page_bbox[2] - page_bbox[0]
    height = page_bbox[3] - page_bbox[1]
    midpoint = page_bbox[0] + width / 2

    physical_lines = []
    for line in element.iter("span"):
        if "ocr_line" not in (line.get("class") or "").split():
            continue
        words = words_for_line(line)
        if not words:
            continue
        bbox = parse_bbox(line.get("title"))
        if not bbox:
            continue
        fsize_match = FSIZE_RE.search(line.get("title") or "")
        font_size = float(fsize_match.group(1)) if fsize_match else float(bbox[3] - bbox[1])
        physical_lines.append(
            {
                "text": " ".join(word["text"] for word in words),
                "words": words,
                "x": bbox[0],
                "x2": bbox[2],
                "y": bbox[1],
                "font": font_size,
            }
        )

    physical_lines.sort(key=lambda item: (item["y"], item["x"]))
    left, right, spanning = [], [], []

    for line in physical_lines:
        words = line["words"]
        on_left = [word for word in words if (word["x1"] + word["x2"]) / 2 < midpoint]
        on_right = [word for word in words if (word["x1"] + word["x2"]) / 2 >= midpoint]
        split_gap = 0
        if on_left and on_right:
            split_gap = on_right[0]["x1"] - on_left[-1]["x2"]

        # A true two-column line has a visible gutter. A centered heading does not.
        if on_left and on_right and split_gap >= 24:
            left.append({"text": " ".join(word["text"] for word in on_left), "y": line["y"], "font": line["font"]})
            right.append({"text": " ".join(word["text"] for word in on_right), "y": line["y"], "font": line["font"]})
        elif all((word["x1"] + word["x2"]) / 2 < midpoint for word in words):
            left.append({"text": line["text"], "y": line["y"], "font": line["font"]})
        elif all((word["x1"] + word["x2"]) / 2 >= midpoint for word in words):
            right.append({"text": line["text"], "y": line["y"], "font": line["font"]})
        else:
            spanning.append({"text": line["text"], "y": line["y"], "font": line["font"]})

    section = section_for_leaf(leaf, sections)
    printed = leaf_to_printed.get(leaf, "")
    if printed:
        for collection in (left, right, spanning):
            collection[:] = [item for item in collection if item["text"].strip() != printed]

    left.sort(key=lambda item: item["y"])
    right.sort(key=lambda item: item["y"])
    spanning.sort(key=lambda item: item["y"])
    first_column_y = min([item["y"] for item in left + right], default=height)
    lead = [item for item in spanning if item["y"] <= first_column_y + 24]
    tail = [item for item in spanning if item["y"] > first_column_y + 24]

    title = choose_title(physical_lines, width, height, section["title"])
    if not plausible_title(title, section):
        title = ""
    orientation = parallel_orientation(left, right) if section["mode"] != "parallel" else "normal"
    if leaf in FORCE_PARALLEL and not orientation:
        orientation = "normal"
    if orientation == "swap":
        left, right = right, left
    reading_text = " ".join(
        item["text"] for item in sorted(physical_lines, key=lambda item: (item["y"], item["x"]))
    )

    return {
        "leaf": leaf,
        "printed": printed,
        "section": section["id"],
        "mode": "parallel" if section["mode"] == "parallel" or orientation else "full",
        "title": title,
        "lead": [line_payload(item) for item in lead],
        "left": [line_payload(item) for item in left],
        "right": [line_payload(item) for item in right],
        "tail": [line_payload(item) for item in tail],
        "text": normalize_space(reading_text),
    }


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def build_search(pages: list[dict], output: Path) -> None:
    postings: dict[str, list[int]] = defaultdict(list)
    for page in pages:
        tokens = set(WORD_RE.findall(normalize_token(page["text"])))
        for token in tokens:
            if len(token) < 3 or len(token) > 32 or token in STOP_WORDS:
                continue
            postings[token].append(page["leaf"])

    shards: dict[str, dict[str, list[int]]] = defaultdict(dict)
    for token, leaves in postings.items():
        if len(leaves) > 1450:
            continue
        key = token[0] if token[0].isalpha() else "_"
        shards[key][token] = leaves

    search_dir = output / "search"
    search_dir.mkdir(parents=True, exist_ok=True)
    for old in search_dir.glob("*.json"):
        old.unlink()
    for key, values in sorted(shards.items()):
        write_json(search_dir / f"{key}.json", dict(sorted(values.items())))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hocr", required=True, type=Path)
    parser.add_argument("--page-numbers", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    output = args.out.resolve()
    if output == Path("/") or len(output.parts) < 4:
        raise SystemExit("Refusing an unsafe output directory.")
    output.mkdir(parents=True, exist_ok=True)
    pages_dir = output / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    for old in pages_dir.glob("*.json"):
        old.unlink()

    leaf_to_printed, printed_to_leaf = page_number_map(args.page_numbers)
    sections = make_sections(printed_to_leaf)
    pages: list[dict] = []

    context = etree.iterparse(
        str(args.hocr),
        events=("end",),
        tag="div",
        html=True,
        recover=True,
        huge_tree=True,
    )
    for _, element in context:
        if "ocr_page" not in (element.get("class") or "").split():
            continue
        pages.append(process_page(element, leaf_to_printed, sections))
        element.clear()
        while element.getprevious() is not None:
            del element.getparent()[0]

    pages.sort(key=lambda page: page["leaf"])
    if not pages or pages[-1]["leaf"] < 1800:
        raise SystemExit(f"Only parsed {len(pages)} pages; refusing to publish incomplete data.")

    for start in range(0, len(pages), CHUNK_SIZE):
        chunk = pages[start : start + CHUNK_SIZE]
        write_json(pages_dir / f"{start // CHUNK_SIZE:03d}.json", chunk)

    section_lookup = {section["id"]: section for section in sections}
    previous_title: dict[str, str] = {}
    previous_anchor: dict[str, tuple[str, int]] = {}
    page_meta = []
    for page_index, page in enumerate(pages):
        section = section_lookup.get(page["section"])
        title = page["title"]
        page_meta.append(
            {
                "leaf": page["leaf"],
                "printed": page["printed"],
                "section": page["section"],
                "title": title,
            }
        )
        previous = previous_anchor.get(section["id"]) if section else None
        near_duplicate = bool(
            previous
            and page["leaf"] - previous[1] <= 7
            and SequenceMatcher(None, title_key(title), previous[0]).ratio() > 0.88
        )
        if (
            section
            and section["group"] != "reference"
            and title
            and title != previous_title.get(section["id"])
            and not near_duplicate
        ):
            anchor_page = page
            if (
                len(page["text"]) < 120
                and page_index + 1 < len(pages)
                and pages[page_index + 1]["section"] == page["section"]
            ):
                anchor_page = pages[page_index + 1]
            section["anchors"].append(
                {
                    "leaf": anchor_page["leaf"],
                    "printed": anchor_page["printed"],
                    "title": title,
                }
            )
            previous_title[section["id"]] = title
            previous_anchor[section["id"]] = (title_key(title), anchor_page["leaf"])

    for page_index, page in enumerate(pages[:-1]):
        following = pages[page_index + 1]
        if (
            page["title"]
            and len(page["text"]) < 120
            and following["section"] == page["section"]
            and not page_meta[page_index + 1]["title"]
        ):
            page_meta[page_index + 1]["title"] = page["title"]

    for section_id, anchors in CURATED_ANCHORS.items():
        section = section_lookup[section_id]
        section["anchors"] = [
            {
                "leaf": leaf,
                "printed": leaf_to_printed.get(leaf, ""),
                "title": title,
            }
            for leaf, title in anchors
        ]

    manifest = {
        "book": {
            "title": "The New Roman Missal",
            "author": "Rev. F. X. Lasance",
            "edition": "1937",
            "leafCount": len(pages),
            "chunkSize": CHUNK_SIZE,
        },
        "sections": sections,
        "contents": [
            {"id": item[0], "title": item[1], "page": item[2]} for item in TOC
        ],
        "pages": page_meta,
        "printedToLeaf": {str(key): value for key, value in sorted(printed_to_leaf.items())},
    }
    write_json(output / "manifest.json", manifest)
    build_search(pages, output)

    print(f"Wrote {len(pages)} pages in {(len(pages) + CHUNK_SIZE - 1) // CHUNK_SIZE} chunks.")
    print(f"Wrote {len(sections)} sections and {sum(len(s['anchors']) for s in sections)} anchors.")


if __name__ == "__main__":
    main()
