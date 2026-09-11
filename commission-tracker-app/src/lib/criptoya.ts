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
  takenos: number | null;    // TiendaCrypto USDT/ARS totalBid; fallback a dólar cripto, luego MEP
}

async function fetchJSON(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export async function fetchLiveRates(): Promise<LiveRates> {
  const [dolar, astro, belo, binance, dolarCripto, tiendacrypto] = await Promise.all([
    fetchJSON("https://criptoya.com/api/dolar"),
    fetchJSON("https://criptoya.com/api/astropay/usdt/ars/1"),
    fetchJSON("https://criptoya.com/api/belo/usdc/ars/1"),
    fetchJSON("https://criptoya.com/api/binancep2p/usdt/ars/1").catch(() => null),
    // dolarapi.com: sin auth, CORS abierto. Trae el "dólar cripto" (CCL calculado vía
    // USDC/USDT). Se usa solo como fallback de Takenos si TiendaCrypto no responde.
    fetchJSON("https://dolarapi.com/v1/dolares/cripto").catch(() => null),
    // TiendaCrypto (vía CriptoYa, mismo dominio con CORS abierto que el resto de las
    // llamadas): su totalBid de USDT/ARS calzó exacto (al centavo) con la tasa real
    // mostrada in-app por Takenos en dos mediciones separadas (sep-2026), evidencia de
    // que es el proveedor de liquidez detrás de la conversión USD→ARS de Takenos.
    fetchJSON("https://criptoya.com/api/tiendacrypto/usdt/ars/1").catch(() => null),
  ]);

  const mep = dolar?.mep?.al30?.["24hs"]?.price ?? null;
  const ccl = dolar?.ccl?.al30?.["24hs"]?.price ?? null;
  const cripto = dolarCripto?.compra ?? null;
  const tiendaCryptoRate = tiendacrypto?.totalBid ?? tiendacrypto?.bid ?? null;

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
    takenos: tiendaCryptoRate ?? cripto ?? mep,
  };
}
