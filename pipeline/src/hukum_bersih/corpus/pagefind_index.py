"""Write a Pagefind index from custom records, with the official ``pagefind`` package.

The package starts the ``pagefind --service`` process and talks to it over a pipe. Its reader
(``PagefindService._wait_for_responses``) sleeps 0.1 s before it reads each reply, which caps
a build at 10 records a second: the 75,000 records of the corpus would take two hours.
``_Service`` is that loop without the sleep. The package is pinned to one version in
``pyproject.toml`` because this overrides one of its private methods.
"""

from __future__ import annotations

import asyncio
import base64
import json
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any, NamedTuple

from pagefind.index import IndexConfig, PagefindIndex
from pagefind.service import PagefindService

# Pagefind bundles the fragments of a language into shared files above this many pages
FRAGMENT_FILE_LIMIT = 2000
# how many records are sent before their replies are awaited
_BATCH = 500


class Record(NamedTuple):
    """One full-text search record: a piece of a page that a result can open directly."""

    url: str
    content: str
    title: str
    label: str


class _Service(PagefindService):
    async def _wait_for_responses(self) -> None:
        stdout = self._backend.stdout
        assert stdout is not None
        try:
            while True:
                reply = json.loads(base64.b64decode((await stdout.readuntil(b","))[:-1]))
                payload = reply["payload"]
                message_id = reply.get("message_id")
                if message_id is None and payload.get("original_message"):
                    message_id = json.loads(payload["original_message"]).get("message_id")
                future = self._responses.get(message_id)
                if future is None:
                    continue
                if payload["type"] == "Error":
                    future.set_exception(Exception(payload["message"],
                                                   payload.get("original_message")))
                else:
                    future.set_result(payload)
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError) as error:
            # the process ended: no reply will come
            for future in self._responses.values():
                if not future.done():
                    future.set_exception(error)


class _Index(PagefindIndex):
    async def _start(self) -> _Index:
        self._service = await _Service().launch()
        self._index_id = (await self._service.create_index(self._config))._index_id
        return self


async def _add(index: PagefindIndex, records: Sequence[Record]) -> None:
    await asyncio.gather(*(
        index.add_custom_record(url=r.url, content=r.content, language="id",
                                meta={"title": r.title, "label": r.label})
        for r in records))


async def _write(records: Iterable[Record], output: Path) -> None:
    config: Any = IndexConfig(max_fragments=FRAGMENT_FILE_LIMIT, output_path=str(output))
    async with _Index(config) as index:             # leaving the block writes the files
        batch: list[Record] = []
        for record in records:
            batch.append(record)
            if len(batch) == _BATCH:
                await _add(index, batch)
                batch = []
        await _add(index, batch)


def write_index(records: Iterable[Record], output: Path) -> None:
    """Index ``records`` in the order given (it decides the page numbers) into ``output``."""
    asyncio.run(_write(records, output.resolve()))
