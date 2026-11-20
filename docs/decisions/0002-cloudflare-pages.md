# 0002 Host on Cloudflare Pages

Date: 2026-11-20 · Decided by: Dante

Static site on Cloudflare Pages (project `hukum-bersih`), deployed from GitHub Actions.

Why: free, unlimited bandwidth, Jakarta edge. Pages rather than Workers because a subdomain of
`suarakami.id` (DNS not in our account) can be attached with a plain CNAME.
Trade-off: 20,000 files and 25 MiB per file per deployment on the free plan, which phase 2
(~17k PP/Perpres) will exceed. Options then: paid plan, R2 for bulk files, or splitting sites.
