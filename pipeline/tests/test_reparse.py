"""A failed download or parse during a re-conversion must keep the stored text."""
import yaml
from recfactory import make_record, make_version

from hukum_bersih.sources import peraturan_go_id as src


class Down:
    def get(self, path):
        raise ConnectionError("peraturan.go.id did not answer")


def _record(tmp_path):
    folder = tmp_path / "peraturan" / "uu" / "2009" / "uu_4_2009"
    folder.mkdir(parents=True)
    (folder / "uu_4_2009_2009-01-12.txt").write_text("BODY\n  ART 1 -\n    Teks.\n")
    rec = make_record("uu_4_2009", tanggal_penetapan="2009-01-12",
                      source_pdf_url="https://peraturan.go.id/files/UU0042009.pdf",
                      versions=[make_version("uu_4_2009", parser_version=1)])
    (folder / "uu_4_2009.yaml").write_text(yaml.safe_dump(rec))
    return folder


def test_download_failure_keeps_text(tmp_path):
    folder = _record(tmp_path)
    lines = list(src.reparse(Down(), "uu", tmp_path))
    assert lines[0].startswith("FAIL uu_4_2009")
    assert (folder / "uu_4_2009_2009-01-12.txt").exists()
    rec = yaml.safe_load((folder / "uu_4_2009.yaml").read_text())
    assert rec["versions"][0]["text"] == "uu_4_2009_2009-01-12.txt"
