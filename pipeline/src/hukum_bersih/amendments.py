"""What an amending law says, pasal by pasal: the new wording of each pasal it changes or
inserts, and the pasal it deletes.

An Indonesian amending law ("Perubahan atas Undang-Undang Nomor ...") has one article, Pasal I,
with numbered instructions:

    1. Ketentuan Pasal 4 diubah sehingga berbunyi sebagai berikut:
       Pasal 4  (1) ... (2) ...
    2. Di antara Pasal 27 dan Pasal 28 disisipkan 2 (dua) pasal, yakni Pasal 27A dan Pasal 27B
       sehingga berbunyi sebagai berikut:  Pasal 27A ...  Pasal 27B ...
    3. Pasal 31 dihapus.

The PDF parser does not know this layout (the quoted pasal become points or articles of the
amending law), so this module works on the stored text flattened back to plain words. The
instruction numbers are checked to follow each other (1, 2, 3 ...) and a quoted pasal is only
cut where the instruction named it, so cross-references ("sebagaimana dimaksud dalam Pasal 4")
are not mistaken for headings. Text is never changed, only split.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .records import load_record
from .relations import _num, _sequence

# A pasal number in an instruction, as OCR may have read it ("l73A", "lSC", "141El").
PASAL_RE = re.compile(r"Pas[ai]l\s+([0-9lI][0-9OIlS]*(?:El|[A-Z]{0,2}))(?=[\s,.;:])")

# The start of an amendment instruction, optionally numbered ("1. Ketentuan Pasal 4 ...",
# "Di antara Pasal 27 dan Pasal 28 ...", "Pasal 9 dihapus."). Not the numbers themselves: OCR
# loses them ("l." for "1.", "1 Ketentuan"), so the wording is what is matched.
_UNIT = r"(?:ayat|huruf|angka|Pas[ai]l|BAB|Bab|Bagian|Paragraf|Penjelasan|Lampiran|[Jj]udul)"
HEAD = re.compile(
    r"(?:(?<=\s)[0-9lI]{1,3}\s?[.,]?\s+)?"
    r"(?:Ketentuan\s+" + _UNIT + r"|Di\s*antara\s+" + _UNIT + r"|Setelah\s+" + _UNIT
    + r"|Pas[ai]l\s+[0-9][0-9OIl]*[A-Z]{0,2}\s+dihapus|(?:Bagian\s+\S+\s+)?(?:BAB|Bab)\s+\S+\s+diubah"
    r"|Judul\s+(?:BAB|Bab|Bagian|Paragraf)|Penjelasan\s+(?:[Uu]mum|Pas[ai]l|ayat))")
VERB = re.compile(r"diubah|dihapus|disisip|ditambah|tetap\s+dengan\s+perubahan")
FOLLOWS = re.compile(r"(?:berbunyi\s+)?sebagai\s+berikut\s*:")
PAGE = re.compile(r"(?:PRESIDEN\s+REPUBLIK\s+INDONESIA\s*)?-\s?\d{1,3}\s?-")
# In scanned "salinan" copies each page ends with a catchword ("Ketentuan...") and an "SK No"
# stamp, followed by the (OCR'd) page header of the next page. Page furniture, not text.
STAMP = re.compile(r"(?:(?<=\s)\S+(?:\s\S+)?\s?\.{2,}\s*(?:\d\s)?)?SK\s*No\.?\s*[\dlIO]+\s*[A-Z]?(?:\s+[A-Z]\b)?"
                   r"(?:\s+P\S{6,8}\s+R\S{6,9}\s+I\S{8,11})?")
CATCHWORD = re.compile(r"(?<=\s)\S+(?:\s\S+)?\s?\.{3}(?:\s+\d)?(?:\s+[A-Z]{6,9}\s+[A-Z]{6,9}\s+[A-Z.]{8,11})?"
                       r"(?=\s)")


@dataclass
class Line:
    num: str | None
    text: str
    indent: int


@dataclass
class NewPasal:
    num: str
    kind: str                       # diubah | disisipkan | dihapus
    text: str = ""                  # the new wording, as one string
    lines: list[Line] = field(default_factory=list)


@dataclass
class Instruction:
    n: int
    header: str                     # "Ketentuan Pasal 4 diubah sehingga berbunyi sebagai berikut:"
    pasal: list[NewPasal] = field(default_factory=list)


def _unescape(s: str) -> str:
    return re.sub(r"\\(.)", r"\1", s)


def flatten(bluebell: str) -> str:
    """The body (BODY .. CONCLUSIONS) of a stored Bluebell text as plain running text, with
    structure keywords turned back into the words of the original ("ART 4 -" -> "Pasal 4")."""
    out: list[str] = []
    inside = False
    for raw in bluebell.splitlines():
        line = raw.strip()
        if raw.startswith("BODY"):
            inside = True
            continue
        if raw[:1].isalpha() and not raw.startswith("BODY"):
            if inside:
                break                       # CONCLUSIONS / ATTACHMENT
            continue
        if not inside or not line:
            continue
        if m := re.match(r"ART\s+(\S+)\s+-(.*)$", line):
            out.append(f"Pasal {_unescape(m[1])}{m[2]}")
        elif m := re.match(r"(CHAPTER|PART|SUBPART)\s+(\S*)\s*-\s*(.*)$", line):
            word = {"CHAPTER": "BAB", "PART": "Bagian", "SUBPART": "Paragraf"}[m[1]]
            out.append(f"{word} {m[2]} {_unescape(m[3])}".replace("  ", " "))
        elif m := re.match(r"(?:PARA|POINT|ITEM)\s+(.+)$", line):
            out.append(_unescape(m[1]))
        else:
            out.append(_unescape(line))
    text = re.sub(r"\s+", " ", " ".join(out))
    return re.sub(r"\s+", " ", PAGE.sub(" ", CATCHWORD.sub(" ", STAMP.sub(" ", text)))).strip()


def instructions(body: str) -> list[Instruction]:
    """Split Pasal I of an amending law into its instructions."""
    start = re.search(r"Pasal\s+I\b", body)
    if not start:
        return []
    ends = list(re.finditer(r"Pasal\s+II\b(?!\s*(?:dan|,))", body))   # the last one: OCR reads
    end = ends[-1].start() if ends and ends[-1].start() > start.end() else len(body)  # 11 as II
    part = body[start.end(): end]
    intro = FOLLOWS.search(part)                # "... diubah sebagai berikut:" then the list
    if intro:
        part = part[intro.end():]
    cuts: list[tuple[int, int]] = []           # (start incl. number, start of wording)
    for m in HEAD.finditer(part):
        number = len(re.match(r"[0-9lI]{1,3}\s?[.,]?\s+|", part[m.start():])[0])
        rest = part[m.start() + number: m.start() + 700]
        stop = FOLLOWS.search(rest)
        header = rest[: stop.start()] if stop else rest.split(". ")[0]
        if VERB.search(header) and not (cuts and m.start() < cuts[-1][1] + 5):
            cuts.append((m.start(), m.start() + number))
    out = []
    for k, (_, at) in enumerate(cuts):
        stop = cuts[k + 1][0] if k + 1 < len(cuts) else len(part)
        out.append(_instruction(k + 1, part[at:stop].strip()))
    return out


def _instruction(n: int, chunk: str) -> Instruction:
    m = FOLLOWS.search(chunk) or re.search(r"sebagai\b.{0,80}?(?=Pas[ai]l\s+\S+\s+\()", chunk)
    header, content = (chunk[: m.end()], chunk[m.end():]) if m else (chunk, "")
    ins = Instruction(n, header.strip())
    head = header.split("sehingga")[0] if "sehingga" in header else header
    deleted = [_num(x) for x in re.findall(r"Pas[ai]l\s+([0-9lI][0-9OIlS]*(?:El|[A-Z]{0,2}))\s+dihapus", head)]
    inserted: list[str] = []
    for mm in re.finditer(r"disisip\S*\s+\S+\s+\(\w+\)\s+pasal,?\s+(?:yakni|yaitu)\s+(.+)", head):
        inserted += _sequence([_num(x) for x in PASAL_RE.findall(mm[1])])
    # positions ("di antara Pasal 45 dan Pasal 46") and the inserted list name no changed pasal
    rest = re.sub(r"[Dd]i\s*antara\s+Pas[ai]l\s+\S+\s+dan\s+Pas[ai]l\s+\S+", " ", head)
    rest = re.sub(r"disisip\S*\s+\S+\s+\(\w+\)\s+pasal.*?(?=;|\bketentuan\b|$)", " ", rest)
    named = [_num(x) for x in PASAL_RE.findall(rest)]
    changed = [x for x in named if x not in inserted and x not in deleted]
    if re.match(r"Di\s*antara|Diantara", head) and len(changed) == 2 and inserted:
        changed = []                            # "Di antara Pasal 27 dan Pasal 28": positions
    named = [x for x in named if re.match(r"\d", x)]
    changed = [x for x in changed if re.match(r"\d", x)]
    if re.search(r"tetap\s+dengan\s+perubahan\s+penjelasan", head) or head.startswith("Penjelasan"):
        changed = []                            # only the Penjelasan changed
    for x in deleted:
        ins.pasal.append(NewPasal(x, "dihapus"))
    targets = [(x, "diubah") for x in dict.fromkeys(changed)] + [(x, "disisipkan") for x in inserted]
    found = _split_pasal(content, targets) if content and targets else []
    got = {p.num for p in found}
    ins.pasal += found + [NewPasal(x, k) for x, k in targets if x not in got]   # text not found
    return ins


def changes(body: str) -> dict[str, list[str]]:
    """Pasal changed / inserted / deleted, per the instructions (empty if none were found)."""
    out: dict[str, set[str]] = {"diubah": set(), "disisipkan": set(), "dihapus": set()}
    for ins in instructions(body):
        for p in ins.pasal:
            out[p.kind].add(p.num)
    out["diubah"] -= out["disisipkan"] | out["dihapus"]
    return {k: sorted(v, key=_key) for k, v in out.items() if v}


def _split_pasal(content: str, targets: list[tuple[str, str]]) -> list[NewPasal]:
    """Cut the quoted text at the headings of the named pasal, in the order they appear."""
    found: list[tuple[int, int, str, str]] = []  # start, text start, num, kind
    pos = 0
    for num, kind in sorted(targets, key=lambda t: _key(t[0])):
        pat = re.compile(rf"Pas[ai]l\s+{_ocr(num)}(?=\s)(?!\s+(?:ayat|huruf|angka|dan|,))")
        m = pat.search(content, pos)
        if m:
            found.append((m.start(), m.end(), num, kind))
            pos = m.end()
    if not found and len(targets) == 1:         # number misread in the heading: one target,
        m = re.match(r"\s*Pas\S{1,3}\s+\S+(?=\s)", content)   # and the text starts with it
        if m:
            found.append((m.start(), m.end(), *targets[0]))
    out = []
    for k, (_, at, num, kind) in enumerate(found):
        stop = found[k + 1][0] if k + 1 < len(found) else len(content)
        text = content[at:stop].strip()
        text = re.sub(r"\s*(?:BAB|Bagian|Paragraf)\s+\S+(?:\s+[A-Z][A-Z ,/]+)?$", "", text)
        out.append(NewPasal(num, kind, text, lines(text)))
    return out


def _key(num: str) -> tuple[int, str]:
    m = re.match(r"(\d+)(.*)", num)
    return (int(m[1]), m[2]) if m else (10**6, num)


def _ocr(num: str) -> str:
    """Pattern for a pasal number as it may appear in an OCR'd text layer (40 / 4O)."""
    digits = "".join({"0": "[0O]", "1": "[1Il]"}.get(c, re.escape(c)) for c in num)
    return digits.replace("B", "[B8]") if num[-1:] == "B" else digits


def lines(text: str) -> list[Line]:
    """Split a pasal's text into ayat, huruf and angka, each numbered in sequence."""
    ayat = _numbered(text, lambda k: f"({k})", range(1, 60), _ayat_pattern)
    if len(ayat) <= 1:
        return _items(text, 0)
    out: list[Line] = []
    lead, ayat = ayat[0], ayat[1:]
    if lead[1]:
        out.append(Line(None, lead[1], 0))
    for label, body in ayat:
        sub = _items(body, 1)
        first = sub[0] if sub and sub[0].num is None else None
        out.append(Line(label, first.text if first else "", 0))
        out += sub[1:] if first else sub
    return out


def _items(text: str, indent: int) -> list[Line]:
    letters = _numbered(text, lambda k: f"{chr(96 + k)}.", range(1, 27))
    first_digit = re.search(r"(?:^|\s)1\.\s", text)
    if len(letters) > 2 and first_digit and first_digit.start() < text.find(letters[1][1]) - 3:
        letters = []                            # "1. ... a. ... b. ... 2. ...": numbers first
    if len(letters) <= 2:                       # a. alone is not a list
        digits = _numbered(text, lambda k: f"{k}.", range(1, 200))
        if len(digits) > 2:                     # definitions: "1. ... 2. ...", maybe with a. b.
            out = [Line(None, digits[0][1], max(indent - 1, 0))] if digits[0][1] else []
            for lab, body in digits[1:]:
                sub = _numbered(body, lambda k: f"{chr(96 + k)}.", range(1, 27))
                if len(sub) > 2:
                    out.append(Line(lab, sub[0][1], indent))
                    out += [Line(sl, sb, indent + 1) for sl, sb in sub[1:]]
                else:
                    out.append(Line(lab, body, indent))
            return out
        return [Line(None, text, max(indent - 1, 0))] if text else []
    out = [Line(None, letters[0][1], max(indent - 1, 0))] if letters[0][1] else []
    for label, body in letters[1:]:
        digits = _numbered(body, lambda k: f"{k}.", range(1, 60))
        if len(digits) > 2:
            out.append(Line(label, digits[0][1], indent))
            out += [Line(lab, b, indent + 1) for lab, b in digits[1:]]
        else:
            out.append(Line(label, body, indent))
    return out


def _ayat_pattern(k: int) -> str:
    """"(2)" as an OCR layer may have read it: "(21", "(2l", "(l)" for "(1)"."""
    digits = "".join({"1": "[1lI]", "0": "[0O]"}.get(c, c) for c in str(k))
    return r"\(" + digits + r"[)1lI\]]"


def _numbered(text: str, label, numbers, pattern=None) -> list[tuple[str | None, str]]:
    """[(None, lead), (label1, text1), ...] for labels found in order, each at a word start.
    Labels are given as written in the law ("(2)"); ``pattern`` may accept OCR misreads."""
    parts: list[tuple[str | None, str]] = []
    pos, last, current = 0, 0, None
    for k in numbers:
        lab = label(k)
        pat = pattern(k) if pattern else re.escape(lab)
        m = re.compile(r"(?:^|(?<=\s))" + pat + r"(?=\s)").search(text, pos)
        if not m:
            break
        parts.append((current, text[last:m.start()].strip()))
        current, last, pos = lab, m.end(), m.end()
    parts.append((current, text[last:].strip()))
    return parts


def split(rec: dict, folder: Path) -> dict | None:
    """What an amending law with one target and a text says, pasal by pasal: the JSON of
    ``build`` as a dict, or None when the law is not such a law or no instruction was found."""
    amends = (rec.get("relationships") or {}).get("amends") or []
    texts = [v["text"] for v in rec.get("versions") or [] if v.get("text")]
    if len(amends) != 1 or not texts:
        return None
    found = instructions(flatten((folder / texts[-1]).read_text()))
    if not found:
        return None
    return {"id": rec["id"], "amends": amends[0]["id"], "instructions": [asdict(i) for i in found]}


def build(data_dir: Path, out_dir: Path) -> int:
    """For every amending law with one target and a text: its instructions, as JSON in
    ``out_dir/amendments/<id>.json`` (for the website; regenerated, not committed)."""
    target = out_dir / "amendments"
    target.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in sorted((data_dir / "peraturan").glob("*/*/*/*.yaml")):
        rec = load_record(path)
        split_up = split(rec, path.parent)
        if split_up:
            (target / f"{rec['id']}.json").write_text(json.dumps(split_up, ensure_ascii=False))
            count += 1
    return count
