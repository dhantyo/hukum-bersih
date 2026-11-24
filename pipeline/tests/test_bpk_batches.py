"""The workflow's batches (one process each) share one Cloudflare clearance and one walk of the
listing, and laws BPK lists without a PDF are not fetched again in every batch."""

import sys
import types
from datetime import date, timedelta
from pathlib import Path

from hukum_bersih.sources import bpk_session
from hukum_bersih.sources import peraturan_bpk as bpk


class Response:
    def __init__(self, status: int, text: str = "", headers=None):
        self.status_code, self.text, self.headers = status, text, headers or {}

    def raise_for_status(self):
        pass


class FakeHttp:
    """Stands in for curl_cffi: answers 200 with the cookie it was given, or a challenge."""

    challenge_cookie = "expired"

    def __init__(self, impersonate):
        self.headers, self.cookies = {}, self

    def set(self, name, value, domain):
        self.cookie = value

    def get(self, url, timeout):
        if self.cookie == self.challenge_cookie:
            return Response(403, headers={"cf-mitigated": "challenge"})
        return Response(200, f"page {url}")


def session(tmp_path, monkeypatch, cookie="fresh"):
    # curl_cffi is in the `bpk` extra, which the unit-test job does not install: a stand-in
    fake = types.ModuleType("curl_cffi")
    fake.requests = types.SimpleNamespace(Session=FakeHttp)
    monkeypatch.setitem(sys.modules, "curl_cffi", fake)
    monkeypatch.setattr(bpk_session.time, "sleep", lambda s: None)
    browser = []

    def clearance():
        browser.append(1)
        return {"cf_clearance": cookie}, "Chrome/1"

    return bpk_session.Session(delay=0, clearance=clearance, state=tmp_path / "session.json"), browser


def test_a_later_batch_reuses_the_saved_clearance(tmp_path, monkeypatch):
    first, browser = session(tmp_path, monkeypatch)
    first.get("/a")
    second, browser2 = session(tmp_path, monkeypatch)            # the next batch's process
    assert second.get("/b").status_code == 200
    assert (browser, browser2) == ([1], [])                         # one browser for both


def test_an_expired_saved_clearance_is_replaced(tmp_path, monkeypatch):
    (tmp_path / "session.json").write_text('{"cookies": {"cf_clearance": "expired"}, "ua": "x"}')
    s, browser = session(tmp_path, monkeypatch)
    assert s.get("/a").status_code == 200
    assert browser == [1]
    assert "fresh" in (tmp_path / "session.json").read_text()


class Listing:
    """BPK's saved first listing page twice, then an empty page; counts what is fetched."""

    def __init__(self):
        self.calls = []

    def get(self, url):
        self.calls.append(url)
        p1 = (Path(__file__).parent / "fixtures" / "bpk" / "search_uu_p1.html").read_text()
        return Response(200, p1 if int(url.rsplit("=", 1)[1]) <= 2 else "")


def test_a_later_batch_reads_the_listing_from_the_cache(tmp_path):
    first, second = Listing(), Listing()
    a = [i.path for i in bpk.listings(first, "uu", tmp_path)]
    b = [i.path for i in bpk.listings(second, "uu", tmp_path)]
    assert len(a) == 20 and a == b
    assert len(first.calls) == 3 and second.calls == []


def no_pdf(checked: date) -> dict:
    return {"bpk": {"id": 1, "files": [], "no_pdf_checked": checked.isoformat()}}


def test_a_law_without_pdf_is_done_until_the_recheck():
    assert bpk.done(no_pdf(date.today()))
    assert not bpk.done(no_pdf(date.today() - timedelta(days=bpk.NO_PDF_RECHECK_DAYS)))
    assert not bpk.done({"bpk": {"id": 1, "files": []}})           # never checked
