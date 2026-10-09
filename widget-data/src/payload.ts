// Arma el JSON del widget de Android. Reutiliza el MISMO código que la web
// (tasas, config de mercado y optimizador v2): no hay una copia aparte de la lógica.
//
// Sin valores de respaldo: si una fuente falla, aparece en `errors` y no se inventa un número.

import { fetchLiveRates } from "../../commission-tracker-app/src/lib/criptoya";
import { DEFAULTS, applyLiveRates, missingRates } from "../../commission-tracker-app/src/lib/marketConfig";
import { REFERENCE_AMOUNT_USD } from "../../commission-tracker-app/src/lib/settings";
import { optimizeRoutes } from "../../commission-tracker-app/src/lib/routeOptimizer";

export const DEFAULT_AMOUNT = REFERENCE_AMOUNT_USD; // mismo monto de referencia que la web

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number, decimals: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

// "Banco en USD → ARS (Takenos)" → "Banco en USD → Takenos". Si el último nodo repite al
// anterior ("… → Belo → ARS (Belo/MEP)") se descarta.
function shortRoute(name: string): string {
  const nodes = name.split(" → ");
  const m = nodes[nodes.length - 1].match(/^ARS \((.*)\)$/);
  if (!m) return name;
  nodes.pop();
  if (!m[1].startsWith(nodes[nodes.length - 1])) nodes.push(m[1]);
  return nodes.join(" → ");
}

export async function buildPayload(amount = DEFAULT_AMOUNT) {
  const rates = await fetchLiveRates();
  const cfg = applyLiveRates({ ...DEFAULTS }, rates, []);

  // Misma jerarquía de tasas que las tarjetas de la web, de mayor a menor.
  const candidates = [
    { name: "AstroPay", rate: cfg.astropayUsdtToArs },
    { name: "Belo", rate: cfg.beloUsdtToArs },
    { name: "Binance P2P", rate: cfg.binanceUsdtToArs },
    { name: "Santander (MEP)", rate: rates.santander },
    { name: "Takenos", rate: cfg.takenosUsdToArs },
  ];
  const ok = candidates
    .filter((r): r is { name: string; rate: number } => typeof r.rate === "number" && r.rate > 0)
    .sort((a, b) => b.rate - a.rate);
  const failed = candidates.filter((r) => !(typeof r.rate === "number" && r.rate > 0));
  const topRates = ok.slice(0, 3).map((r) => ({ name: r.name, rate: round2(r.rate) }));

  // Mejor combinación = la misma que muestra la V2 (results[0]).
  const best = optimizeRoutes(amount, cfg)[0] ?? null;
  const now = new Date();
  // Hora local de Argentina (UTC-3 fija, sin horario de verano): el widget no convierte husos.
  const updatedTime = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires",
  }).format(now);

  // Filas listas para dibujar (el widget no formatea nada): primero las tasas disponibles,
  // y si faltan para llegar a 3, las fuentes caídas como error.
  const rows = [
    ...ok.map((r, i) => ({ rank: String(i + 1), name: r.name, value: `$${fmt(r.rate, 2)}`, error: false, isError: 0, best: i === 0, isBest: i === 0 ? 1 : 0 })),
    ...failed.map((r) => ({ rank: "–", name: r.name, value: "Error: sin tasa", error: true, isError: 1, best: false, isBest: 0 })),
  ].slice(0, 3);

  return {
    updatedAt: now.toISOString(),
    updatedEpoch: Math.floor(now.getTime() / 1000), // segundos; el widget calcula "hace N min"
    amountUSD: amount,
    topRates,
    bestRoute: best && {
      name: best.name,
      finalARS: round2(best.finalARS),
      effectiveRate: round2(best.effectiveRate),
    },
    errors: missingRates(cfg, rates).map((s) => `Sin tasa en vivo: ${s}`),
    // Textos ya formateados para el widget (es-AR)
    display: {
      rows,
      status: failed.length ? `⚠ ${failed.length} ${failed.length === 1 ? "fuente sin datos" : "fuentes sin datos"}` : "",
      hasError: failed.length > 0,
      hasErrorNum: failed.length > 0 ? 1 : 0, // 1/0 para fórmulas de KWGT
      updatedTime,
      // Texto de la esquina superior derecha: aviso en rojo si falta una fuente.
      header: failed.length ? `⚠ ${failed.length} ${failed.length === 1 ? "fuente sin datos" : "fuentes sin datos"} · ${updatedTime}` : `Act. ${updatedTime}`,
      routeName: best ? shortRoute(best.name) : "Error: sin rutas",
      routeTotal: best ? `$${fmt(best.finalARS, 0)}` : "Error",
      routeCaption: `por US$ ${fmt(amount, 0)}`,
    },
  };
}
