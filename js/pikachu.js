import { createCollectionApp, money } from "./collection-app.js";
import {
  drawHistoryChart,
  fetchLiveProduct,
  historySeries,
  latestMarket,
  loadPriceBook,
} from "./tcgplayer.js";

const priceBook = {
  updatedAt: "",
  products: {},
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

function productFor(item) {
  const pid = item.tcgplayer_product_id;
  if (!pid) return null;
  return priceBook.products[pid] || null;
}

function priceValue(item) {
  const live = latestMarket(productFor(item));
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
    el.textContent = "TCGPlayer prices unavailable";
    return;
  }
  const date = new Date(priceBook.updatedAt);
  el.textContent = `TCGPlayer market · updated ${date.toLocaleString()}`;
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
      priceBook.products = book.products;
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
  const cached = productFor(item);
  modal.priceNote.textContent = item.tcgplayer_product_id
    ? priceBook.updatedAt
      ? `TCGPlayer market · refreshing live… (snapshot ${new Date(
          priceBook.updatedAt
        ).toLocaleString()})`
      : "Loading latest TCGPlayer market price…"
    : "No TCGPlayer product mapping for this variant.";
  if (item.tcgplayer_url) {
    modal.link.href = item.tcgplayer_url;
    modal.link.hidden = false;
  } else {
    modal.link.hidden = true;
  }
  modal.status.textContent = cached?.history?.length
    ? "Chart shows saved TCGPlayer market history."
    : "";
  modal.root.classList.remove("hidden");
  document.body.classList.add("modal-open");
  drawHistoryChart(modal.chart, historySeries(cached));

  if (!item.tcgplayer_product_id) return;

  fetchLiveProduct(item.tcgplayer_product_id)
    .then((liveProduct) => {
      priceBook.products[item.tcgplayer_product_id] = {
        ...(priceBook.products[item.tcgplayer_product_id] || {}),
        ...liveProduct,
      };
      const market = latestMarket(liveProduct);
      modal.price.textContent = market != null ? money(market) : priceText(item);
      modal.priceNote.textContent = `Live TCGPlayer market · ${new Date(
        liveProduct.fetchedAt
      ).toLocaleString()}`;
      drawHistoryChart(modal.chart, historySeries(liveProduct));
      modal.status.textContent = "Chart shows recent TCGPlayer market history.";
      app.render();
      app.updateProgress();
    })
    .catch((error) => {
      console.warn(error);
      modal.priceNote.textContent = priceBook.updatedAt
        ? `TCGPlayer market · snapshot ${new Date(priceBook.updatedAt).toLocaleString()}`
        : "Could not refresh live price; showing checklist value.";
      modal.status.textContent =
        "Live refresh unavailable right now; showing saved TCGPlayer snapshot.";
    });
}

modal.closeEls.forEach((el) => el.addEventListener("click", closeModal));
modal.root?.addEventListener("click", (event) => {
  if (event.target === modal.root) closeModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.root?.classList.contains("hidden")) closeModal();
});
