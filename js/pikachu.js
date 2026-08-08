import { createCollectionApp, money } from "./collection-app.js";

createCollectionApp({
  checklistPath: "../data/pikachu/checklist.csv",
  ownedPath: "../data/pikachu/owned.csv",
  itemNoun: "card",
  titleField: "set",
  searchFields: ["set", "edition", "year", "remarks", "rarity", "artwork"],
  showOwnedValue: true,
  mediaClass: "media-card",
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
    { value: "set", label: "Set name" },
  ],
  metaBits: (item) => [item.year, item.edition, item.rarity],
  detailText: (item) => item.remarks || "",
  priceText: (item) => (item.market_price ? money(item.market_price) : "—"),
  compare: (a, b, mode) => {
    const price = (item) => Number(item.market_price) || 0;
    const year = (item) => Number(item.year) || 0;
    switch (mode) {
      case "price-desc":
        return price(b) - price(a);
      case "price-asc":
        return price(a) - price(b);
      case "year-desc":
        return year(b) - year(a) || a.set.localeCompare(b.set);
      case "year-asc":
        return year(a) - year(b) || a.set.localeCompare(b.set);
      case "set":
        return a.set.localeCompare(b.set) || a.id.localeCompare(b.id);
      default:
        return 0;
    }
  },
});
