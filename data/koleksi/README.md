# Koleksi (law collections)

A collection groups one law with the laws that amend it and the laws it replaced, under the
name people use for it ("UU ITE", "UU Minerba"). One file per named collection:

```yaml
slug: ite                       # URL: /koleksi/ite/
name: UU ITE                    # the common short name
title: Informasi dan Transaksi Elektronik
base: uu_11_2008                # the law the others amend
aliases: [ite]                  # extra search words
members: []                     # optional: laws to add that the relations do not link
```

Members are worked out from `relationships` in the law records (`hukum-bersih relations`):
the base law, every law that amends it, and the laws it revoked. Amended laws without a file
here get an unnamed collection automatically, titled after their subject.
