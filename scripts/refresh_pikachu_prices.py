#!/usr/bin/env python3
"""Refresh TCGPlayer market snapshots for mapped Pikachu checklist cards."""

from __future__ import annotations

import csv
import json
import time
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "data" / "pikachu" / "checklist.csv"
PRICES = ROOT / "data" / "pikachu" / "prices.json"

UA = {"User-Agent": "CollectionDashboard/1.0 (+https://github.com/)"}
CTX = ssl.create_default_context()


def fetch_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=45) as response:
        return json.load(response)


def main() -> None:
    rows = list(csv.DictReader(CHECKLIST.open(encoding="utf-8")))
    product_ids = sorted(
        {row["tcgplayer_product_id"] for row in rows if row.get("tcgplayer_product_id")},
        key=lambda value: int(value),
    )

    products = {}
    for index, pid in enumerate(product_ids, start=1):
        for attempt in range(4):
            try:
                points = fetch_json(f"https://mpapi.tcgplayer.com/v2/product/{pid}/pricepoints")
                hist = fetch_json(
                    f"https://infinite-api.tcgplayer.com/price/history/{pid}?range=quarter"
                )
                if hist.get("count", 0) < 8:
                    hist = fetch_json(
                        f"https://infinite-api.tcgplayer.com/price/history/{pid}?range=annual"
                    )

                variants = {}
                market = None
                for point in points:
                    printing = point.get("printingType") or "Normal"
                    variants[printing] = {
                        "market": point.get("marketPrice"),
                        "listed_median": point.get("listedMedianPrice"),
                        "buylist_market": point.get("buylistMarketPrice"),
                    }
                    if market is None and point.get("marketPrice") is not None:
                        market = point.get("marketPrice")

                history = []
                for day in hist.get("result") or []:
                    for variant in day.get("variants") or []:
                        history.append(
                            {
                                "date": day.get("date"),
                                "variant": variant.get("variant") or "Normal",
                                "market": (
                                    float(variant["marketPrice"])
                                    if variant.get("marketPrice") not in (None, "")
                                    else None
                                ),
                                "avg_sales": (
                                    float(variant["averageSalesPrice"])
                                    if variant.get("averageSalesPrice") not in (None, "")
                                    else None
                                ),
                                "quantity": (
                                    int(float(variant["quantity"]))
                                    if variant.get("quantity") not in (None, "")
                                    else 0
                                ),
                            }
                        )

                products[pid] = {"market": market, "variants": variants, "history": history}
                print(f"[{index}/{len(product_ids)}] {pid} market={market}")
                break
            except Exception as exc:  # noqa: BLE001
                print(f"retry {pid} {attempt}: {exc}")
                time.sleep(1.2 * (attempt + 1))
        time.sleep(0.08)

    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "TCGPlayer",
        "products": products,
    }
    PRICES.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    # Keep checklist market_price column in sync for sorting fallbacks.
    fields = list(rows[0].keys())
    for row in rows:
        pid = row.get("tcgplayer_product_id")
        market = products.get(pid, {}).get("market")
        if market is not None:
            row["market_price"] = f"{float(market):.2f}"
    with CHECKLIST.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {PRICES} with {len(products)} products")


if __name__ == "__main__":
    main()
