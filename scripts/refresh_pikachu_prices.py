#!/usr/bin/env python3
"""Refresh PriceCharting ungraded market snapshots for Pikachu checklist cards."""

from __future__ import annotations

import csv
import json
import re
import time
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "data" / "pikachu" / "checklist.csv"
PRICES = ROOT / "data" / "pikachu" / "prices.json"

UA = {
    "User-Agent": (
        "CollectionDashboard/1.0 "
        "(+https://github.com/jdmerchan11/collection-dashboard)"
    ),
    "Accept": "text/html,application/xhtml+xml",
}
CTX = ssl.create_default_context()

PRICE_RE = re.compile(
    r'id="used_price".*?class="price js-price">\s*\$([0-9,.]+)',
    re.S | re.I,
)
PRODUCT_ID_RE = re.compile(r"VGPC\.product\s*=\s*\{[^}]*?\bid\s*:\s*(\d+)", re.S)
CHART_RE = re.compile(r"VGPC\.chart_data\s*=\s*(\{.*?\})\s*;", re.S)


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=45) as response:
        return response.read().decode("utf-8", "replace")


def parse_money(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw.replace(",", "").replace("$", "").strip())
    except ValueError:
        return None


def history_from_chart(chart_json: str) -> list[dict]:
    try:
        data = json.loads(chart_json)
    except json.JSONDecodeError:
        return []

    points = data.get("used") or []
    history: list[dict] = []
    for entry in points:
        if not isinstance(entry, (list, tuple)) or len(entry) < 2:
            continue
        ts_ms, cents = entry[0], entry[1]
        if cents in (None, 0, "0"):
            continue
        try:
            day = datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc).strftime(
                "%Y-%m-%d"
            )
            market = round(float(cents) / 100.0, 2)
        except (TypeError, ValueError, OSError):
            continue
        history.append({"date": day, "market": market})
    return history


def scrape_card(url: str) -> dict:
    html = fetch_html(url)
    market = None
    match = PRICE_RE.search(html)
    if match:
        market = parse_money(match.group(1))

    pricecharting_id = None
    match = PRODUCT_ID_RE.search(html)
    if match:
        pricecharting_id = match.group(1)

    history: list[dict] = []
    match = CHART_RE.search(html)
    if match:
        history = history_from_chart(match.group(1))

    if market is None and history:
        market = history[-1]["market"]

    return {
        "market": market,
        "pricecharting_url": url,
        "pricecharting_id": pricecharting_id,
        "history": history,
    }


def main() -> None:
    rows = list(csv.DictReader(CHECKLIST.open(encoding="utf-8")))
    targets = [(row["id"], row["pricecharting_url"]) for row in rows if row.get("pricecharting_url")]

    cards: dict[str, dict] = {}
    for index, (card_id, url) in enumerate(targets, start=1):
        for attempt in range(4):
            try:
                payload = scrape_card(url)
                cards[card_id] = payload
                print(
                    f"[{index}/{len(targets)}] {card_id} market={payload.get('market')} url={url}"
                )
                break
            except Exception as exc:  # noqa: BLE001
                print(f"retry {card_id} {attempt}: {exc}")
                time.sleep(1.2 * (attempt + 1))
        time.sleep(0.25)

    out = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "PriceCharting",
        "cards": cards,
    }
    PRICES.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    fields = list(rows[0].keys())
    for row in rows:
        market = cards.get(row["id"], {}).get("market")
        if market is not None:
            row["market_price"] = f"{float(market):.2f}"
    with CHECKLIST.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    priced = sum(1 for item in cards.values() if item.get("market") is not None)
    print(f"Wrote {PRICES} with {len(cards)} cards ({priced} priced)")


if __name__ == "__main__":
    main()
