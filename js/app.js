const DATA_PATHS = {
  checklist: "./data/checklist.csv",
  owned: "./data/owned.csv",
};

const state = {
  cards: [],
  ownedIds: new Set(),
  ownedNotes: new Map(),
};

const els = {
  grid: document.getElementById("card-grid"),
  empty: document.getElementById("empty-state"),
  results: document.getElementById("results-count"),
  search: document.getElementById("search-input"),
  status: document.getElementById("status-filter"),
  year: document.getElementById("year-filter"),
  rarity: document.getElementById("rarity-filter"),
  sort: document.getElementById("sort-select"),
  progressLabel: document.getElementById("progress-label"),
  progressPct: document.getElementById("progress-pct"),
  progressBar: document.getElementById("progress-bar"),
  progressFill: document.getElementById("progress-fill"),
  statOwned: document.getElementById("stat-owned"),
  statMissing: document.getElementById("stat-missing"),
  statValue: document.getElementById("stat-value"),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((value) => String(value).trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

async function loadCsv(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }
  return parseCsv(await response.text());
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
}

function fillSelect(select, values, allLabel) {
  const current = select.value || "all";
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  select.appendChild(all);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = values.includes(current) ? current : "all";
}

function updateProgress() {
  const total = state.cards.length;
  const owned = state.cards.filter((card) => state.ownedIds.has(card.id)).length;
  const missing = Math.max(total - owned, 0);
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const ownedValue = state.cards
    .filter((card) => state.ownedIds.has(card.id))
    .reduce((sum, card) => sum + (Number(card.market_price) || 0), 0);

  els.progressLabel.textContent = `${owned} / ${total} collected`;
  els.progressPct.textContent = `${pct}%`;
  els.progressFill.style.width = `${pct}%`;
  els.progressBar.setAttribute("aria-valuenow", String(pct));
  els.statOwned.textContent = String(owned);
  els.statMissing.textContent = String(missing);
  els.statValue.textContent = money(ownedValue);
}

function cardMatches(card, query, status, year, rarity) {
  const owned = state.ownedIds.has(card.id);

  if (status === "owned" && !owned) return false;
  if (status === "missing" && owned) return false;
  if (year !== "all" && card.year !== year) return false;
  if (rarity !== "all" && card.rarity !== rarity) return false;

  if (!query) return true;

  const haystack = [
    card.id,
    card.set,
    card.edition,
    card.year,
    card.remarks,
    card.rarity,
    card.artwork,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function sortCards(cards, mode) {
  const sorted = [...cards];
  const price = (card) => Number(card.market_price) || 0;
  const year = (card) => Number(card.year) || 0;

  switch (mode) {
    case "price-desc":
      return sorted.sort((a, b) => price(b) - price(a));
    case "price-asc":
      return sorted.sort((a, b) => price(a) - price(b));
    case "year-desc":
      return sorted.sort((a, b) => year(b) - year(a) || a.set.localeCompare(b.set));
    case "year-asc":
      return sorted.sort((a, b) => year(a) - year(b) || a.set.localeCompare(b.set));
    case "set":
      return sorted.sort((a, b) => a.set.localeCompare(b.set) || a.id.localeCompare(b.id));
    default:
      return sorted;
  }
}

function renderCards() {
  const query = els.search.value.trim().toLowerCase();
  const status = els.status.value;
  const year = els.year.value;
  const rarity = els.rarity.value;
  const sort = els.sort.value;

  const filtered = sortCards(
    state.cards.filter((card) => cardMatches(card, query, status, year, rarity)),
    sort
  );

  els.results.textContent = `${filtered.length} card${filtered.length === 1 ? "" : "s"} shown`;
  els.grid.innerHTML = "";

  if (!filtered.length) {
    els.empty.classList.remove("hidden");
    return;
  }

  els.empty.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  filtered.forEach((card, index) => {
    const owned = state.ownedIds.has(card.id);
    const article = document.createElement("article");
    article.className = `card${owned ? " is-owned" : ""}`;
    article.style.animationDelay = `${Math.min(index, 24) * 18}ms`;

    const media = document.createElement("div");
    media.className = "card-media";

    const chip = document.createElement("span");
    chip.className = `status-chip ${owned ? "owned" : "missing"}`;
    chip.textContent = owned ? "Owned" : "Missing";
    media.appendChild(chip);

    if (card.image_url) {
      const img = document.createElement("img");
      img.src = card.image_url;
      img.alt = card.set || "Pikachu card";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.replaceWith(Object.assign(document.createElement("div"), {
          className: "placeholder",
          textContent: "No image",
        }));
      };
      media.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      placeholder.textContent = "No image";
      media.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("p");
    title.className = "card-set";
    title.textContent = card.set;

    const metaBits = [card.year, card.edition, card.rarity].filter(Boolean);
    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = metaBits.join(" · ");

    if (card.remarks) {
      const remarks = document.createElement("p");
      remarks.className = "card-meta";
      remarks.textContent = card.remarks;
      body.append(title, meta, remarks);
    } else {
      body.append(title, meta);
    }

    const price = document.createElement("p");
    price.className = "card-price";
    price.textContent = card.market_price ? money(card.market_price) : "—";

    const id = document.createElement("p");
    id.className = "card-id";
    id.textContent = card.id;

    const note = state.ownedNotes.get(card.id);
    if (note) {
      const noteEl = document.createElement("p");
      noteEl.className = "card-meta";
      noteEl.textContent = note;
      body.append(price, id, noteEl);
    } else {
      body.append(price, id);
    }

    article.append(media, body);
    fragment.appendChild(article);
  });

  els.grid.appendChild(fragment);
}

function bindControls() {
  ["input", "change"].forEach((eventName) => {
    els.search.addEventListener(eventName, renderCards);
  });
  [els.status, els.year, els.rarity, els.sort].forEach((el) => {
    el.addEventListener("change", renderCards);
  });
}

async function init() {
  try {
    const [checklistRows, ownedRows] = await Promise.all([
      loadCsv(DATA_PATHS.checklist),
      loadCsv(DATA_PATHS.owned),
    ]);

    state.cards = checklistRows.map((row) => ({
      id: row.id,
      image_url: row.image_url,
      set: row.set,
      edition: row.edition,
      year: row.year,
      remarks: row.remarks,
      rarity: row.rarity,
      artwork: row.artwork,
      market_price: row.market_price,
    }));

    state.ownedIds = new Set(
      ownedRows.map((row) => row.id).filter((id) => id && state.cards.some((c) => c.id === id))
    );
    state.ownedNotes = new Map(
      ownedRows
        .filter((row) => row.id && row.notes)
        .map((row) => [row.id, row.notes])
    );

    const years = [...new Set(state.cards.map((c) => c.year).filter(Boolean))].sort(
      (a, b) => Number(b) - Number(a)
    );
    const rarities = [...new Set(state.cards.map((c) => c.rarity).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );

    fillSelect(els.year, years, "All years");
    fillSelect(els.rarity, rarities, "All rarities");
    updateProgress();
    renderCards();
  } catch (error) {
    console.error(error);
    els.results.textContent = "Could not load checklist data.";
    els.empty.textContent = error.message;
    els.empty.classList.remove("hidden");
  }
}

bindControls();
init();
