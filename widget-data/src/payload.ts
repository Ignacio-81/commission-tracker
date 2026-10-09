// Arma el JSON del widget de Android. Reutiliza el MISMO código que la web
// (tasas, config de mercado y optimizador v2): no hay una copia aparte de la lógica.
//
// Sin valores de respaldo: si una fuente falla, aparece en `errors` y no se inventa un número.

import { fetchLiveRates } from "../../commission-tracker-app/src/lib/criptoya";
import { DEFAULTS, applyLiveRates, missingRates } from "../../commission-tracker-app/src/lib/marketConfig";
import { optimizeRoutes } from "../../commission-tracker-app/src/lib/routeOptimizer";

export const DEFAULT_AMOUNT = 3450; // mismo monto de referencia que la web

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildPayload(amount = DEFAULT_AMOUNT) {
  const rates = await fetchLiveRates();
  const cfg = applyLiveRates({ ...DEFAULTS }, rates, []);

  // Misma jerarquía de tasas que las tarjetas de la web, de mayor a menor.
  const topRates = [
    { name: "AstroPay", rate: cfg.astropayUsdtToArs },
    { name: "Belo", rate: cfg.beloUsdtToArs },
    { name: "Binance P2P", rate: cfg.binanceUsdtToArs },
    { name: "Santander (MEP)", rate: rates.santander },
    { name: "Takenos", rate: cfg.takenosUsdToArs },
  ]
    .filter((r): r is { name: string; rate: number } => typeof r.rate === "number" && r.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map((r) => ({ name: r.name, rate: round2(r.rate) }));

  // Mejor combinación = la misma que muestra la V2 (results[0]).
  const best = optimizeRoutes(amount, cfg)[0] ?? null;

  return {
    updatedAt: new Date().toISOString(),
    amountUSD: amount,
    topRates,
    bestRoute: best && {
      name: best.name,
      finalARS: round2(best.finalARS),
      effectiveRate: round2(best.effectiveRate),
    },
    errors: missingRates(cfg, rates).map((s) => `Sin tasa en vivo: ${s}`),
  };
}
