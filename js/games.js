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
  checklistPath: "../data/games/checklist.csv",
  ownedPath: "../data/games/owned.csv",
  itemNoun: "game",
  titleField: "title",
  searchFields: ["title", "platform", "generation", "year", "kind", "notes"],
  showOwnedValue: false,
  mediaClass: "media-boxart",
  clickable: true,
  onItemClick: openModal,
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

function openModal(item) {
  if (!modal.root) return;
  modal.title.textContent = item.title;
  modal.meta.textContent = [
    item.year,
    item.platform,
    item.generation ? `Gen ${item.generation}` : "",
    item.kind,
  ]
    .filter(Boolean)
    .join(" · ");
  modal.detail.textContent = item.notes || "";
  modal.detail.hidden = !item.notes;
  if (modal.owned) {
    const owned = app.isOwned(item.id);
    modal.owned.textContent = owned ? "Owned" : "Missing";
    modal.owned.className = `status-chip ${owned ? "owned" : "missing"}`;
  }
  setModalNotes(modal.notes, modal.notesLabel, app.getOwnedNote(item.id));
  modal.image.src = item.image_url || "";
  modal.image.alt = item.title;
  modal.root.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
