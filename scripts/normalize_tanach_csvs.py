#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


REFERENCE_RE = re.compile(r"^(?P<book>.+) (?P<chapter>\d+):(?P<verse>\d+)$")
CHAPTER_REF_RE = re.compile(r"^(?P<book>.+) (?P<chapter>\d+)$")


def load_books(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            rows.append(
                {
                    "book_number": raw["Book Number"].strip(),
                    "canonical_name": raw["Book Name"].strip(),
                    "chapter_count": raw["Chapter Count"].strip(),
                    "verse_count": raw["Verse Count"].strip(),
                }
            )
    return rows


def load_chapters(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            chapter_ref = raw.get("Chapter Ref", "").strip()
            if not chapter_ref:
                chapter_ref = f'{raw["Book"].strip()} {raw["Chapter Number"].strip()}'
            rows.append(
                {
                    "book_name": raw["Book"].strip(),
                    "chapter_number": raw["Chapter Number"].strip(),
                    "verse_count": raw["Verse Count"].strip(),
                    "chapter_ref": chapter_ref,
                }
            )
    return rows


def load_verses(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            reference = raw["Reference"].strip()
            chapter_ref = raw["Chapter"].strip()
            match = REFERENCE_RE.match(reference)
            if not match:
                raise ValueError(f"Could not parse verse reference: {reference}")
            chapter_match = CHAPTER_REF_RE.match(chapter_ref)
            if not chapter_match:
                raise ValueError(f"Could not parse chapter reference: {chapter_ref}")

            book_from_reference = match.group("book").strip()
            chapter_from_reference = match.group("chapter").strip()
            verse_number = match.group("verse").strip()
            book_from_chapter = chapter_match.group("book").strip()
            chapter_from_chapter = chapter_match.group("chapter").strip()

            if book_from_reference != book_from_chapter:
                raise ValueError(
                    f"Book mismatch between reference and chapter fields: {reference} / {chapter_ref}"
                )
            if chapter_from_reference != chapter_from_chapter:
                raise ValueError(
                    f"Chapter mismatch between reference and chapter fields: {reference} / {chapter_ref}"
                )

            rows.append(
                {
                    "book_name": raw["Book"].strip(),
                    "chapter_ref": chapter_ref,
                    "verse_number": verse_number,
                    "reference": reference,
                    "verse_text": raw.get("Verse Text", "").strip(),
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize Tanach CSVs into SQL-friendly import files."
    )
    parser.add_argument("--books", required=True, type=Path)
    parser.add_argument("--chapters", required=True, type=Path)
    parser.add_argument("--verses", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    books = load_books(args.books)
    chapters = load_chapters(args.chapters)
    verses = load_verses(args.verses)

    write_csv(
        args.out_dir / "books.csv",
        books,
        ["book_number", "canonical_name", "chapter_count", "verse_count"],
    )
    write_csv(
        args.out_dir / "chapters.csv",
        chapters,
        ["book_name", "chapter_number", "verse_count", "chapter_ref"],
    )
    write_csv(
        args.out_dir / "verses.csv",
        verses,
        ["book_name", "chapter_ref", "verse_number", "reference", "verse_text"],
    )

    print(f"Wrote {len(books)} books to {args.out_dir / 'books.csv'}")
    print(f"Wrote {len(chapters)} chapters to {args.out_dir / 'chapters.csv'}")
    print(f"Wrote {len(verses)} verses to {args.out_dir / 'verses.csv'}")


if __name__ == "__main__":
    main()
