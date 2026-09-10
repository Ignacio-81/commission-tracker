// Cliente de tasas en vivo desde CriptoYa (CORS abierto, funciona desde el navegador).
// Si preferís usar el backend Supabase, ver supabase/functions/get-exchange-rates/index.ts
// y reemplazá fetchLiveRates() por supabase.functions.invoke('get-exchange-rates').

export interface LiveRates {
  belo: number | null;       // USDC/ARS totalBid
  astropay: number | null;   // USDT/ARS totalBid
  binance: number | null;    // Binance P2P USDT/ARS totalBid
  mep: number | null;        // Dólar MEP AL30 24hs
  ccl: number | null;        // Dólar CCL AL30 24hs
  cripto: number | null;     // Dólar cripto (dolarapi.com) — CCL vía USDC/USDT
  payoneer: number | null;   // CCL * 0.99
  grabrfi: number | null;    // = MEP
  santander: number | null;  // = MEP
  takenos: number | null;    // = dólar cripto (Takenos opera con USDC, no con bonos); fallback a MEP
}

async function fetchJSON(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export async function fetchLiveRates(): Promise<LiveRates> {
  const [dolar, astro, belo, binance, dolarCripto] = await Promise.all([
    fetchJSON("https://criptoya.com/api/dolar"),
    fetchJSON("https://criptoya.com/api/astropay/usdt/ars/1"),
    fetchJSON("https://criptoya.com/api/belo/usdc/ars/1"),
    fetchJSON("https://criptoya.com/api/binancep2p/usdt/ars/1").catch(() => null),
    // dolarapi.com: sin auth, CORS abierto. Trae el "dólar cripto" (CCL calculado vía
    // USDC/USDT), que es la referencia real de Takenos porque opera con stablecoins,
    // no con el bono AL30 del MEP. Verificado contra la app de Takenos (sep-2026):
    // el dólar cripto está a ~0.2% de la tasa real mostrada in-app, contra ~3% del MEP.
    fetchJSON("https://dolarapi.com/v1/dolares/cripto").catch(() => null),
  ]);

  const mep = dolar?.mep?.al30?.["24hs"]?.price ?? null;
  const ccl = dolar?.ccl?.al30?.["24hs"]?.price ?? null;
  const cripto = dolarCripto?.compra ?? null;

  return {
    mep,
    ccl,
    cripto,
    astropay: astro?.totalBid ?? astro?.bid ?? null,
    belo: belo?.totalBid ?? belo?.bid ?? null,
    binance: binance?.totalBid ?? binance?.bid ?? null,
    payoneer: ccl ? ccl * 0.99 : null,
    grabrfi: mep,
    santander: mep,
    takenos: cripto ?? mep,
  };
}
