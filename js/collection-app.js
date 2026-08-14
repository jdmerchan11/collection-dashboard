import { loadCsv } from "./csv.js";

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
  if (!select) return;
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

function el(id) {
  return document.getElementById(id);
}

/**
 * @param {object} config
 * @param {string} config.checklistPath
 * @param {string} config.ownedPath
 * @param {string} config.itemNoun
 * @param {string} config.titleField
 * @param {string[]} config.searchFields
 * @param {Array<{id:string,key:string,allLabel:string,sort?:'alpha'|'numeric-desc'}>} config.filters
 * @param {Array<{value:string,label:string}>} config.sortOptions
 * @param {(item:object)=>string[]} config.metaBits
 * @param {(item:object)=>string} [config.detailText]
 * @param {(item:object)=>string} [config.priceText]
 * @param {(item:object)=>number|null} [config.priceValue]
 * @param {boolean} [config.showOwnedValue]
 * @param {string} [config.mediaClass]
 * @param {boolean} [config.clickable]
 * @param {(item:object)=>void} [config.onItemClick]
 * @param {()=>Promise<void>} [config.beforeRender]
 * @param {(a:object,b:object,mode:string)=>number} [config.compare]
 */
export function createCollectionApp(config) {
  const state = {
    items: [],
    ownedIds: new Set(),
    ownedNotes: new Map(),
  };

  const els = {
    grid: el("item-grid"),
    empty: el("empty-state"),
    results: el("results-count"),
    search: el("search-input"),
    status: el("status-filter"),
    sort: el("sort-select"),
    progressLabel: el("progress-label"),
    progressPct: el("progress-pct"),
    progressBar: el("progress-bar"),
    progressFill: el("progress-fill"),
    statOwned: el("stat-owned"),
    statMissing: el("stat-missing"),
    statValue: el("stat-value"),
    valueStat: el("value-stat"),
  };

  const filterEls = Object.fromEntries(
    (config.filters || []).map((filter) => [filter.id, el(filter.id)])
  );

  function updateProgress() {
    const total = state.items.length;
    const owned = state.items.filter((item) => state.ownedIds.has(item.id)).length;
    const missing = Math.max(total - owned, 0);
    const pct = total ? Math.round((owned / total) * 100) : 0;

    els.progressLabel.textContent = `${owned} / ${total} collected`;
    els.progressPct.textContent = `${pct}%`;
    els.progressFill.style.width = `${pct}%`;
    els.progressBar.setAttribute("aria-valuenow", String(pct));
    els.statOwned.textContent = String(owned);
    els.statMissing.textContent = String(missing);

    if (config.showOwnedValue && els.statValue) {
      const ownedValue = state.items
        .filter((item) => state.ownedIds.has(item.id))
        .reduce((sum, item) => {
          const live = config.priceValue?.(item);
          const value = live != null ? live : Number(item.market_price) || 0;
          return sum + value;
        }, 0);
      els.statValue.textContent = money(ownedValue);
      els.valueStat?.classList.remove("hidden");
    } else {
      els.valueStat?.classList.add("hidden");
    }
  }

  function matches(item, query, status) {
    const owned = state.ownedIds.has(item.id);
    if (status === "owned" && !owned) return false;
    if (status === "missing" && owned) return false;

    for (const filter of config.filters || []) {
      const select = filterEls[filter.id];
      const value = select?.value || "all";
      if (value !== "all" && item[filter.key] !== value) return false;
    }

    if (!query) return true;
    const ownedNote = state.ownedNotes.get(item.id) || "";
    const haystack = config.searchFields
      .map((field) => item[field] || "")
      .concat(item.id, ownedNote)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function sortItems(items, mode) {
    const sorted = [...items];
    if (config.compare) {
      return sorted.sort((a, b) => config.compare(a, b, mode));
    }
    return sorted;
  }

  function render() {
    const query = els.search.value.trim().toLowerCase();
    const status = els.status.value;
    const sort = els.sort.value;
    const filtered = sortItems(
      state.items.filter((item) => matches(item, query, status)),
      sort
    );

    const noun = config.itemNoun;
    els.results.textContent = `${filtered.length} ${noun}${filtered.length === 1 ? "" : "s"} shown`;
    els.grid.innerHTML = "";

    if (!filtered.length) {
      els.empty.classList.remove("hidden");
      return;
    }

    els.empty.classList.add("hidden");
    const fragment = document.createDocumentFragment();

    filtered.forEach((item, index) => {
      const owned = state.ownedIds.has(item.id);
      const article = document.createElement("article");
      article.className = `card${owned ? " is-owned" : ""}${config.clickable ? " is-clickable" : ""}`;
      article.style.animationDelay = `${Math.min(index, 24) * 18}ms`;
      if (config.clickable) {
        article.tabIndex = 0;
        article.setAttribute("role", "button");
        article.setAttribute(
          "aria-label",
          `Open details for ${item[config.titleField] || config.itemNoun}`
        );
        const open = () => config.onItemClick?.(item);
        article.addEventListener("click", open);
        article.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      }

      const media = document.createElement("div");
      media.className = `card-media ${config.mediaClass || ""}`.trim();

      const chip = document.createElement("span");
      chip.className = `status-chip ${owned ? "owned" : "missing"}`;
      chip.textContent = owned ? "Owned" : "Missing";
      media.appendChild(chip);

      if (item.image_url) {
        const img = document.createElement("img");
        img.src = item.image_url;
        img.alt = item[config.titleField] || noun;
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
          img.replaceWith(
            Object.assign(document.createElement("div"), {
              className: "placeholder",
              textContent: item[config.titleField] || "No image",
            })
          );
        };
        media.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder title-placeholder";
        placeholder.textContent = item[config.titleField] || noun;
        media.appendChild(placeholder);
      }

      const body = document.createElement("div");
      body.className = "card-body";

      const title = document.createElement("p");
      title.className = "card-set";
      title.textContent = item[config.titleField];

      const meta = document.createElement("p");
      meta.className = "card-meta";
      meta.textContent = config.metaBits(item).filter(Boolean).join(" · ");

      body.append(title, meta);

      const detail = config.detailText?.(item);
      if (detail) {
        const detailEl = document.createElement("p");
        detailEl.className = "card-meta";
        detailEl.textContent = detail;
        body.appendChild(detailEl);
      }

      const priceLabel = config.priceText?.(item);
      if (priceLabel) {
        const price = document.createElement("p");
        price.className = "card-price";
        price.textContent = priceLabel;
        body.appendChild(price);
      }

      const id = document.createElement("p");
      id.className = "card-id";
      id.textContent = item.id;
      body.appendChild(id);

      const note = state.ownedNotes.get(item.id);
      if (note) {
        const noteEl = document.createElement("p");
        noteEl.className = "card-meta";
        noteEl.textContent = note;
        body.appendChild(noteEl);
      }

      article.append(media, body);
      fragment.appendChild(article);
    });

    els.grid.appendChild(fragment);
  }

  function bindControls() {
    ["input", "change"].forEach((eventName) => {
      els.search.addEventListener(eventName, render);
    });
    [els.status, els.sort, ...Object.values(filterEls)].forEach((control) => {
      control?.addEventListener("change", render);
    });
  }

  async function init() {
    try {
      const [checklistRows, ownedRows] = await Promise.all([
        loadCsv(config.checklistPath),
        loadCsv(config.ownedPath),
      ]);

      if (config.beforeRender) {
        await config.beforeRender();
      }

      state.items = checklistRows;
      state.ownedIds = new Set(
        ownedRows
          .map((row) => row.id)
          .filter((id) => id && state.items.some((item) => item.id === id))
      );
      state.ownedNotes = new Map(
        ownedRows.filter((row) => row.id && row.notes).map((row) => [row.id, row.notes])
      );

      for (const filter of config.filters || []) {
        const values = [...new Set(state.items.map((item) => item[filter.key]).filter(Boolean))];
        if (filter.sort === "numeric-desc") {
          values.sort((a, b) => Number(b) - Number(a));
        } else {
          values.sort((a, b) => a.localeCompare(b));
        }
        fillSelect(filterEls[filter.id], values, filter.allLabel);
      }

      if (els.sort && config.sortOptions?.length) {
        const current = els.sort.value;
        els.sort.innerHTML = "";
        config.sortOptions.forEach((option) => {
          const node = document.createElement("option");
          node.value = option.value;
          node.textContent = option.label;
          els.sort.appendChild(node);
        });
        els.sort.value = config.sortOptions.some((o) => o.value === current)
          ? current
          : config.sortOptions[0].value;
      }

      updateProgress();
      render();
    } catch (error) {
      console.error(error);
      els.results.textContent = "Could not load checklist data.";
      els.empty.textContent = error.message;
      els.empty.classList.remove("hidden");
    }
  }

  bindControls();
  const ready = init();

  return {
    ready,
    render,
    updateProgress,
    getItems: () => state.items,
    isOwned: (id) => state.ownedIds.has(id),
    getOwnedNote: (id) => state.ownedNotes.get(id) || "",
  };
}

export { money };
