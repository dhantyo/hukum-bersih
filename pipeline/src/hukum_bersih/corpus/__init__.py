"""The web corpus written from ``data/``: JSON the website reads and CI uploads unchanged.

Every file is written by ``write.py`` so its bytes equal what the TypeScript export wrote
with ``JSON.stringify``; ``scripts/compare_corpus.py`` proves it against a reference stage.

The modules port the TypeScript of the Astro site; where a docstring names ``web/src/lib/<file>.ts``,
read that file in git history at commit 26e4d76f (the site was removed afterwards).
"""
