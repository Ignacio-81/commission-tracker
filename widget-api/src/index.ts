// Worker de Cloudflare para el widget de Android.
// Reutiliza el MISMO código que la web (tasas, config y optimizador v2), así que
// no hay una tercera copia de la lógica de rutas.
//
// GET /?amount=3450  →  { updatedAt, amountUSD, topRates[3], bestRoute, errors[] }
// Sin valores de respaldo: si una fuente falla, aparece en `errors` y no se inventa un número.

import { fetchLiveRates } from "../../commission-tracker-app/src/lib/criptoya";
import { DEFAULTS, applyLiveRates, missingRates } from "../../commission-tracker-app/src/lib/marketConfig";
import { optimizeRoutes } from "../../commission-tracker-app/src/lib/routeOptimizer";

const DEFAULT_AMOUNT = 3450; // mismo monto de referencia que la web

const CORS = { "access-control-allow-origin": "*" };

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const amount = Number(url.searchParams.get("amount")) || DEFAULT_AMOUNT;

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
      .slice(0, 3);

    // Mejor combinación = la misma que muestra la V2 (results[0]).
    const best = optimizeRoutes(amount, cfg)[0] ?? null;

    const body = {
      updatedAt: new Date().toISOString(),
      amountUSD: amount,
      topRates,
      bestRoute: best && {
        name: best.name,
        finalARS: Math.round(best.finalARS * 100) / 100,
        effectiveRate: Math.round(best.effectiveRate * 100) / 100,
      },
      errors: missingRates(cfg, rates).map((s) => `Sin tasa en vivo: ${s}`),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300", // 5 min, igual que el refresco de la web
        ...CORS,
      },
    });
  },
};
