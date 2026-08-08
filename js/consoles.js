import { createCollectionApp } from "./collection-app.js";

createCollectionApp({
  checklistPath: "../data/consoles/checklist.csv",
  ownedPath: "../data/consoles/owned.csv",
  itemNoun: "console",
  titleField: "name",
  searchFields: ["name", "family", "form", "year", "notes"],
  showOwnedValue: false,
  mediaClass: "media-wide",
  filters: [
    { id: "form-filter", key: "form", allLabel: "All forms", sort: "alpha" },
    { id: "family-filter", key: "family", allLabel: "All families", sort: "alpha" },
    { id: "year-filter", key: "year", allLabel: "All years", sort: "numeric-desc" },
  ],
  sortOptions: [
    { value: "checklist", label: "Checklist order" },
    { value: "year-asc", label: "Year: oldest" },
    { value: "year-desc", label: "Year: newest" },
    { value: "name", label: "Name" },
    { value: "family", label: "Family" },
  ],
  metaBits: (item) => [item.year, item.form, item.family],
  detailText: (item) => item.notes || "",
  compare: (a, b, mode) => {
    const year = (item) => Number(item.year) || 0;
    switch (mode) {
      case "year-desc":
        return year(b) - year(a) || a.name.localeCompare(b.name);
      case "year-asc":
        return year(a) - year(b) || a.name.localeCompare(b.name);
      case "name":
        return a.name.localeCompare(b.name);
      case "family":
        return a.family.localeCompare(b.family) || year(a) - year(b);
      default:
        return 0;
    }
  },
});
