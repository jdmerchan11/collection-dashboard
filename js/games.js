import { createCollectionApp } from "./collection-app.js";

createCollectionApp({
  checklistPath: "../data/games/checklist.csv",
  ownedPath: "../data/games/owned.csv",
  itemNoun: "game",
  titleField: "title",
  searchFields: ["title", "platform", "generation", "year", "kind", "notes"],
  showOwnedValue: false,
  mediaClass: "media-wide",
  filters: [
    { id: "platform-filter", key: "platform", allLabel: "All platforms", sort: "alpha" },
    { id: "generation-filter", key: "generation", allLabel: "All generations", sort: "numeric-desc" },
    { id: "kind-filter", key: "kind", allLabel: "Original & remakes", sort: "alpha" },
  ],
  sortOptions: [
    { value: "checklist", label: "Checklist order" },
    { value: "year-asc", label: "Year: oldest" },
    { value: "year-desc", label: "Year: newest" },
    { value: "title", label: "Title" },
    { value: "platform", label: "Platform" },
  ],
  metaBits: (item) => [
    item.year,
    item.platform,
    item.generation ? `Gen ${item.generation}` : "",
    item.kind,
  ],
  detailText: (item) => item.notes || "",
  compare: (a, b, mode) => {
    const year = (item) => Number(item.year) || 0;
    switch (mode) {
      case "year-desc":
        return year(b) - year(a) || a.title.localeCompare(b.title);
      case "year-asc":
        return year(a) - year(b) || a.title.localeCompare(b.title);
      case "title":
        return a.title.localeCompare(b.title);
      case "platform":
        return a.platform.localeCompare(b.platform) || year(a) - year(b);
      default:
        return 0;
    }
  },
});
