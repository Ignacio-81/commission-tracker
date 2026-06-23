// Supabase Edge Function (Deno) — OPCIONAL.
// La app web usa CriptoYa directo desde el navegador (src/lib/criptoya.ts).
// Usá esta función si querés centralizar el fetch en el backend o agregar scraping (FIRECRAWL_API_KEY).
// Deploy: supabase functions deploy get-exchange-rates --no-verify-jwt

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeJSON(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const DEFAULTS = {
  belo: { achIncomingFee: 0.3, achIncomingMin: 0.5, wireIncomingFee: 20 },
  grabrfi: { achIncomingFee: 0, achOutgoingFee: 0.3, achOutgoingMin: 1, achOutgoingMax: 5, wireIncomingFee: 5, feeSource: "official-documentation" },
  payoneer: { achIncomingFee: 1, achOutgoingFee: 2 },
  astropay: { achIncomingFee: 0, conversionFee: 2.5 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const [astro, beloCY, beloApp, dolar] = await Promise.all([
    safeJSON("https://criptoya.com/api/astropay/usdt/ars/1"),
    safeJSON("https://criptoya.com/api/belo/usdc/ars/1"),
    safeJSON("https://api.belo.app/public/price"),
    safeJSON("https://criptoya.com/api/dolar"),
  ]);

  const now = new Date().toISOString();
  const astropaySell = astro?.totalBid ?? astro?.bid ?? null;
  let beloSell = beloCY?.totalBid ?? beloCY?.bid ?? null;
  if (!beloSell && Array.isArray(beloApp)) {
    const pair = beloApp.find((p: any) => p?.pairCode === "USDT/ARS");
    beloSell = pair?.bid ?? pair?.price ?? null;
  }
  const mep = dolar?.mep?.al30?.["24hs"]?.price ?? null;
  const ccl = dolar?.ccl?.al30?.["24hs"]?.price ?? null;

  const data = {
    belo: { usdToArs: beloSell, ...DEFAULTS.belo, lastUpdated: now, source: "criptoya", feeSource: "scraped+default" },
    astropay: { usdToArs: astropaySell, ...DEFAULTS.astropay, lastUpdated: now, source: "criptoya", feeSource: "official-documentation" },
    grabrfi: { usdToArs: mep, ...DEFAULTS.grabrfi, lastUpdated: now, source: "criptoya-mep" },
    payoneer: { usdToArs: ccl ? ccl * 0.99 : null, ...DEFAULTS.payoneer, lastUpdated: now, source: "criptoya-ccl", feeSource: "official-documentation" },
    santander: { usdToArs: mep, lastUpdated: now, source: "criptoya-mep" },
  };

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
