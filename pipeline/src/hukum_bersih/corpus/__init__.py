"""The web corpus written from ``data/``: JSON the website reads and CI uploads unchanged.

Every file is written by ``write.py`` so its bytes equal what the TypeScript export wrote
with ``JSON.stringify``; ``scripts/compare_corpus.py`` proves it against a reference stage.
"""
