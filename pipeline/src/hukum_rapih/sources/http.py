"""Polite HTTP: identifiable User-Agent, retries with backoff, streamed downloads."""

from __future__ import annotations

import re
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from .. import USER_AGENT


def download(url: str, dest: Path, retries: int = 3) -> None:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with httpx.stream(
                "GET", url, headers={"User-Agent": USER_AGENT}, follow_redirects=True,
                timeout=httpx.Timeout(60, read=300),
            ) as r:
                r.raise_for_status()
                with dest.open("wb") as f:
                    for chunk in r.iter_bytes(1 << 20):
                        f.write(chunk)
            return
        except httpx.HTTPError as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"download failed after {retries} attempts: {url}: {last}")


def safe_filename(url: str) -> str:
    """The source's own file name, made safe for storage and display."""
    p = Path(unquote(urlparse(url).path))
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", p.stem).strip("-.") or "document"
    suffix = re.sub(r"[^A-Za-z0-9.]+", "", p.suffix)
    return stem + suffix
