import { createCollectionApp } from "./collection-app.js";
import { bindModalChrome, setModalNotes } from "./item-modal.js";

const modal = {
  root: document.getElementById("item-modal"),
  image: document.getElementById("modal-image"),
  title: document.getElementById("modal-title"),
  meta: document.getElementById("modal-meta"),
  detail: document.getElementById("modal-detail"),
  notesLabel: document.getElementById("modal-notes-label"),
  notes: document.getElementById("modal-notes"),
  owned: document.getElementById("modal-owned"),
};

bindModalChrome(modal.root);

const app = createCollectionApp({
  checklistPath: "../data/consoles/checklist.csv",
  ownedPath: "../data/consoles/owned.csv",
  itemNoun: "console",
  titleField: "name",
  searchFields: ["name", "family", "form", "year", "notes"],
  showOwnedValue: false,
  mediaClass: "media-wide",
  clickable: true,
  onItemClick: openModal,
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

function openModal(item) {
  if (!modal.root) return;
  modal.title.textContent = item.name;
  modal.meta.textContent = [item.year, item.form, item.family].filter(Boolean).join(" · ");
  modal.detail.textContent = item.notes || "";
  modal.detail.hidden = !item.notes;
  if (modal.owned) {
    const owned = app.isOwned(item.id);
    modal.owned.textContent = owned ? "Owned" : "Missing";
    modal.owned.className = `status-chip ${owned ? "owned" : "missing"}`;
  }
  setModalNotes(modal.notes, modal.notesLabel, app.getOwnedNote(item.id));
  modal.image.src = item.image_url || "";
  modal.image.alt = item.name;
  modal.root.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
