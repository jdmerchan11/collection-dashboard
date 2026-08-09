import { createCollectionApp, money } from "./collection-app.js";
import {
  drawHistoryChart,
  historySeries,
  latestMarket,
  loadPriceBook,
} from "./tcgplayer.js";

const priceBook = {
  updatedAt: "",
  source: "PriceCharting",
  cards: {},
};

const modal = {
  root: document.getElementById("card-modal"),
  closeEls: [...document.querySelectorAll("[data-close-modal]")],
  image: document.getElementById("modal-image"),
  title: document.getElementById("modal-title"),
  meta: document.getElementById("modal-meta"),
  remarks: document.getElementById("modal-remarks"),
  price: document.getElementById("modal-price"),
  priceNote: document.getElementById("modal-price-note"),
  link: document.getElementById("modal-tcg-link"),
  chart: document.getElementById("price-chart"),
  status: document.getElementById("modal-status"),
};

function entryFor(item) {
  if (!item?.id) return null;
  return priceBook.cards[item.id] || null;
}

function priceValue(item) {
  const live = latestMarket(entryFor(item));
  if (live != null) return live;
  const fallback = Number(item.market_price);
  return Number.isFinite(fallback) ? fallback : null;
}

function priceText(item) {
  const value = priceValue(item);
  return value != null ? money(value) : "—";
}

function setPriceUpdatedLabel() {
  const el = document.getElementById("price-updated");
  if (!el) return;
  if (!priceBook.updatedAt) {
    el.textContent = "PriceCharting prices unavailable";
    return;
  }
  const date = new Date(priceBook.updatedAt);
  el.textContent = `PriceCharting ungraded · updated ${date.toLocaleString()}`;
}

function closeModal() {
  modal.root?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  modal.image.src = "";
}

function setNumberLabel(item) {
  return [item.set_name, item.number].filter(Boolean).join(" ");
}

const app = createCollectionApp({
  checklistPath: "../data/pikachu/checklist.csv",
  ownedPath: "../data/pikachu/owned.csv",
  itemNoun: "card",
  titleField: "name",
  searchFields: [
    "name",
    "display_name",
    "set_name",
    "number",
    "edition",
    "year",
    "remarks",
    "rarity",
    "artwork",
  ],
  showOwnedValue: true,
  mediaClass: "media-card",
  clickable: true,
  onItemClick: openModal,
  filters: [
    { id: "year-filter", key: "year", allLabel: "All years", sort: "numeric-desc" },
    { id: "rarity-filter", key: "rarity", allLabel: "All rarities", sort: "alpha" },
  ],
  sortOptions: [
    { value: "checklist", label: "Checklist order" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "year-desc", label: "Year: newest" },
    { value: "year-asc", label: "Year: oldest" },
    { value: "name", label: "Card name" },
    { value: "set", label: "Set name" },
  ],
  metaBits: (item) => [setNumberLabel(item), item.year, item.edition, item.rarity],
  detailText: (item) => item.remarks || "",
  priceText,
  priceValue,
  beforeRender: async () => {
    try {
      const book = await loadPriceBook("../data/pikachu/prices.json");
      priceBook.updatedAt = book.updatedAt;
      priceBook.source = book.source || "PriceCharting";
      priceBook.cards = book.cards;
      setPriceUpdatedLabel();
    } catch (error) {
      console.warn("Price book unavailable", error);
      setPriceUpdatedLabel();
    }
  },
  compare: (a, b, mode) => {
    const price = (item) => priceValue(item) || 0;
    const year = (item) => Number(item.year) || 0;
    switch (mode) {
      case "price-desc":
        return price(b) - price(a);
      case "price-asc":
        return price(a) - price(b);
      case "year-desc":
        return year(b) - year(a) || a.display_name.localeCompare(b.display_name);
      case "year-asc":
        return year(a) - year(b) || a.display_name.localeCompare(b.display_name);
      case "name":
        return a.name.localeCompare(b.name) || setNumberLabel(a).localeCompare(setNumberLabel(b));
      case "set":
        return a.set_name.localeCompare(b.set_name) || a.number.localeCompare(b.number);
      default:
        return 0;
    }
  },
});

function openModal(item) {
  if (!modal.root) return;
  modal.title.textContent = item.name;
  modal.meta.textContent = [setNumberLabel(item), item.year, item.edition, item.rarity]
    .filter(Boolean)
    .join(" · ");
  modal.remarks.textContent = item.remarks || "";
  modal.remarks.hidden = !item.remarks;
  modal.image.src = item.image_url || "";
  modal.image.alt = item.display_name || item.name;
  modal.price.textContent = priceText(item);

  const cached = entryFor(item);
  if (item.pricecharting_url) {
    modal.priceNote.textContent = priceBook.updatedAt
      ? `PriceCharting ungraded · snapshot ${new Date(priceBook.updatedAt).toLocaleString()}`
      : "PriceCharting ungraded market price";
  } else {
    modal.priceNote.textContent = "No PriceCharting listing mapped for this variant.";
  }

  const href = item.pricecharting_url || item.tcgplayer_url;
  if (href) {
    modal.link.href = href;
    modal.link.textContent = item.pricecharting_url
      ? "View on PriceCharting"
      : "View on TCGPlayer";
    modal.link.hidden = false;
  } else {
    modal.link.hidden = true;
  }

  modal.status.textContent = cached?.history?.length
    ? "Chart shows PriceCharting ungraded history."
    : item.pricecharting_url
      ? "No historic PriceCharting data for this listing yet."
      : "";
  modal.root.classList.remove("hidden");
  document.body.classList.add("modal-open");
  drawHistoryChart(modal.chart, historySeries(cached));
}

modal.closeEls.forEach((el) => el.addEventListener("click", closeModal));
modal.root?.addEventListener("click", (event) => {
  if (event.target === modal.root) closeModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.root?.classList.contains("hidden")) closeModal();
});
