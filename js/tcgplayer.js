export async function loadPriceBook(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const data = await response.json();
  return {
    updatedAt: data.updated_at || "",
    source: data.source || "PriceCharting",
    cards: data.cards || {},
    // Legacy TCGPlayer shape (ignored by current UI).
    products: data.products || {},
  };
}

export function latestMarket(entry) {
  if (!entry) return null;
  if (entry.market != null && Number.isFinite(Number(entry.market))) {
    return Number(entry.market);
  }
  const history = entry.history || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const value = history[i]?.market;
    if (value != null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function sortAscendingByDate(points) {
  return [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function historySeries(entry) {
  const history = entry?.history || [];
  const series = history
    .filter((point) => point?.market != null && Number.isFinite(Number(point.market)))
    .map((point) => ({
      date: point.date,
      market: Number(point.market),
    }));
  return sortAscendingByDate(series);
}

function ensureChartTooltip(canvas) {
  const wrap = canvas.parentElement;
  if (!wrap) return null;
  let tooltip = wrap.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip hidden";
    tooltip.setAttribute("role", "status");
    wrap.appendChild(tooltip);
  }
  return tooltip;
}

function moneyLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
}

export function drawHistoryChart(canvas, series) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (canvas._chartCleanup) {
    canvas._chartCleanup();
    canvas._chartCleanup = null;
  }

  const tooltip = ensureChartTooltip(canvas);
  if (tooltip) {
    tooltip.classList.add("hidden");
    tooltip.textContent = "";
  }

  const ordered = sortAscendingByDate(series || []);

  if (!ordered.length) {
    ctx.fillStyle = "#7a7264";
    ctx.font = "14px Figtree, sans-serif";
    ctx.fillText("No historic price data available.", 16, height / 2);
    canvas._chartPoints = [];
    return;
  }

  const values = ordered.map((p) => p.market);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = { top: 18, right: 14, bottom: 28, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const span = max - min || 1;

  function paint(activeIndex = -1) {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(28,25,20,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i += 1) {
      const y = pad.top + (plotH * i) / 3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      const val = max - (span * i) / 3;
      ctx.fillStyle = "#7a7264";
      ctx.font = "11px Figtree, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`$${val.toFixed(val >= 100 ? 0 : 2)}`, pad.left - 8, y + 4);
    }

    const points = ordered.map((point, index) => {
      const x = pad.left + (plotW * index) / Math.max(ordered.length - 1, 1);
      const y = pad.top + plotH - ((point.market - min) / span) * plotH;
      return { x, y, ...point };
    });
    canvas._chartPoints = points;

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, "rgba(224,155,0,0.28)");
    gradient.addColorStop(1, "rgba(224,155,0,0.02)");

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = "#c48900";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.lineTo(points[points.length - 1].x, height - pad.bottom);
    ctx.lineTo(points[0].x, height - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    if (activeIndex >= 0 && points[activeIndex]) {
      const active = points[activeIndex];
      ctx.beginPath();
      ctx.strokeStyle = "rgba(28,25,20,0.28)";
      ctx.lineWidth = 1;
      ctx.moveTo(active.x, pad.top);
      ctx.lineTo(active.x, height - pad.bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = "#c48900";
      ctx.arc(active.x, active.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff8e8";
      ctx.stroke();
    }

    const first = ordered[0]?.date || "";
    const last = ordered[ordered.length - 1]?.date || "";
    ctx.fillStyle = "#7a7264";
    ctx.font = "11px Figtree, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(first, pad.left, height - 8);
    ctx.textAlign = "right";
    ctx.fillText(last, width - pad.right, height - 8);

    return points;
  }

  const points = paint(-1);

  function nearestIndex(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    if (!points.length) return -1;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((point, index) => {
      const dist = Math.abs(point.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    if (x < pad.left - 12 || x > width - pad.right + 12) return -1;
    return best;
  }

  function onMove(event) {
    const index = nearestIndex(event.clientX);
    if (index < 0) {
      paint(-1);
      tooltip?.classList.add("hidden");
      return;
    }
    const painted = paint(index);
    const point = painted[index];
    if (!tooltip || !point) return;
    tooltip.textContent = `${point.date}: ${moneyLabel(point.market)}`;
    tooltip.classList.remove("hidden");

    const wrap = canvas.parentElement;
    const wrapRect = wrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / width;
    const scaleY = canvasRect.height / height;
    const left = canvasRect.left - wrapRect.left + point.x * scaleX;
    const top = canvasRect.top - wrapRect.top + point.y * scaleY;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(8, top - 12)}px`;
  }

  function onLeave() {
    paint(-1);
    tooltip?.classList.add("hidden");
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.style.cursor = "crosshair";

  canvas._chartCleanup = () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.style.cursor = "";
    tooltip?.classList.add("hidden");
  };
}
