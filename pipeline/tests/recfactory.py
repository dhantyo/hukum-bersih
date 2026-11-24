"""A well-formed law record for tests that write one to disk (save_record refuses the rest)."""


def make_version(work: str, date: str = "2009-01-12", **over) -> dict:
    return {"id": f"{work}_{date}", "kind": "asli", "source": "official", "date": date,
            "date_basis": "tanggal_penetapan", "text": f"{work}_{date}.txt", "pasal_count": 1,
            **over}


def make_record(work: str = "uu_4_2009", **over) -> dict:
    jenis, nomor, tahun = work.split("_")
    rec = {
        "id": work, "akn": f"/akn/id/act/{jenis}/{tahun}/{nomor}", "type": jenis, "number": nomor,
        "year": int(tahun), "title": f"{jenis.upper()} Nomor {nomor} Tahun {tahun}",
        "tentang": None, "short_name": None, "status": None, "tanggal_penetapan": None,
        "tempat_penetapan": None, "pejabat_penetapan": None, "pemrakarsa": None,
        "source_url": None, "source_pdf_url": None,
        "relationships": {"amends": [], "amended_by": [], "revokes": [], "revoked_by": []},
        "versions": [],
    }
    return {**rec, **over}
