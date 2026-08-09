const PROXY_BUILDERS = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchJson(url, { proxy = false } = {}) {
  if (!proxy) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  let lastError;
  for (const build of PROXY_BUILDERS) {
    try {
      const response = await fetch(build(url), { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Proxy fetch failed");
}

export async function loadPriceBook(path) {
  const data = await fetchJson(path);
  return {
    updatedAt: data.updated_at || "",
    source: data.source || "TCGPlayer",
    products: data.products || {},
  };
}

export function latestMarket(product) {
  if (!product) return null;
  if (product.market != null && Number.isFinite(Number(product.market))) {
    return Number(product.market);
  }
  const variants = product.variants || {};
  for (const key of ["Normal", "Holofoil", "Foil", "1st Edition", "Unlimited"]) {
    const value = variants[key]?.market;
    if (value != null && Number.isFinite(Number(value))) return Number(value);
  }
  for (const variant of Object.values(variants)) {
    if (variant?.market != null && Number.isFinite(Number(variant.market))) {
      return Number(variant.market);
    }
  }
  return null;
}

export function historySeries(product, preferredVariant = "Normal") {
  const history = product?.history || [];
  const byVariant = new Map();
  history.forEach((point) => {
    const variant = point.variant || "Normal";
    if (!byVariant.has(variant)) byVariant.set(variant, []);
    if (point.market != null) {
      byVariant.get(variant).push({
        date: point.date,
        market: Number(point.market),
        avgSales: point.avg_sales != null ? Number(point.avg_sales) : null,
        quantity: point.quantity || 0,
      });
    }
  });

  if (byVariant.has(preferredVariant)) return byVariant.get(preferredVariant);
  if (byVariant.size) return [...byVariant.values()].sort((a, b) => b.length - a.length)[0];
  return [];
}

/** Live refresh from TCGPlayer public endpoints (via CORS proxy). */
export async function fetchLiveProduct(productId) {
  const id = String(productId);
  const priceUrl = `https://mpapi.tcgplayer.com/v2/product/${id}/pricepoints`;
  const historyUrl = `https://infinite-api.tcgplayer.com/price/history/${id}?range=quarter`;

  const [points, hist] = await Promise.all([
    fetchJson(priceUrl, { proxy: true }),
    fetchJson(historyUrl, { proxy: true }),
  ]);

  const variants = {};
  let market = null;
  for (const point of points || []) {
    const printing = point.printingType || "Normal";
    variants[printing] = {
      market: point.marketPrice,
      listed_median: point.listedMedianPrice,
      buylist_market: point.buylistMarketPrice,
    };
    if (market == null && point.marketPrice != null) market = point.marketPrice;
  }

  const history = [];
  for (const day of hist?.result || []) {
    for (const variant of day.variants || []) {
      history.push({
        date: day.date,
        variant: variant.variant || "Normal",
        market:
          variant.marketPrice != null && variant.marketPrice !== ""
            ? Number(variant.marketPrice)
            : null,
        avg_sales:
          variant.averageSalesPrice != null && variant.averageSalesPrice !== ""
            ? Number(variant.averageSalesPrice)
            : null,
        quantity:
          variant.quantity != null && variant.quantity !== ""
            ? Number(variant.quantity)
            : 0,
      });
    }
  }

  return {
    market,
    variants,
    history,
    live: true,
    fetchedAt: new Date().toISOString(),
  };
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

  if (!series.length) {
    ctx.fillStyle = "#7a7264";
    ctx.font = "14px Figtree, sans-serif";
    ctx.fillText("No historic price data available.", 16, height / 2);
    return;
  }

  const values = series.map((p) => p.market);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = { top: 18, right: 14, bottom: 28, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const span = max - min || 1;

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

  const points = series.map((point, index) => {
    const x = pad.left + (plotW * index) / Math.max(series.length - 1, 1);
    const y = pad.top + plotH - ((point.market - min) / span) * plotH;
    return { x, y, ...point };
  });

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

  const first = series[0]?.date || "";
  const last = series[series.length - 1]?.date || "";
  ctx.fillStyle = "#7a7264";
  ctx.font = "11px Figtree, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(first, pad.left, height - 8);
  ctx.textAlign = "right";
  ctx.fillText(last, width - pad.right, height - 8);
}
