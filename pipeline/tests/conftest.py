import pytest


@pytest.fixture(autouse=True)
def ocr_cache_dir(tmp_path, monkeypatch):
    """Every test gets its own empty OCR cache: none reads or fills the user's real one."""
    monkeypatch.setenv("HUKUM_BERSIH_OCR_CACHE", str(tmp_path / "ocr-cache"))
