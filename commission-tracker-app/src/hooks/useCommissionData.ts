import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveRates, type LiveRates } from "../lib/criptoya";
import {
  DEFAULTS, withoutRates, applyLiveRates, missingRates,
  type MarketConfig,
} from "../lib/marketConfig";
export type { MarketConfig, RateKey, FeeKey } from "../lib/marketConfig";
import type {
  WalletCommission,
  TransferPath,
  TransferStep,
  ComparisonResult,
} from "../types/commission";

const CFG_KEY = "marketConfig.v1";
const MANUAL_KEY = "marketConfig.manualKeys.v1";
const HISTORY_KEY = "history.v1";
const HISTORY_MAX = 5000;
// Monto fijo con el que se calcula el punto del histórico (tasa = ARS finales / monto).
const SNAPSHOT_AMOUNT = 1000;

const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
const step = (
  from: string, to: string, type: TransferStep["type"],
  fee: number, feeType: TransferStep["feeType"], amount: number, resultAmount: number | null,
): TransferStep => ({ from, to, type, fee, feeType, amount, resultAmount });

export interface HistoryPoint {
  t: number;
  rate: number;
  route: string;
  belo?: number | null;
  binance?: number | null;
  mep?: number | null;
}

// Las tasas guardadas en localStorage se descartan al cargar: serían valores viejos.
function loadConfig(): MarketConfig {
  try { return withoutRates({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }); }
  catch { return { ...DEFAULTS }; }
}

function loadManual(): string[] {
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]"); }
  catch { return []; }
}

export function useCommissionData() {
  const [commissions, setCommissions] = useState<WalletCommission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [marketConfig, setMarketConfigState] = useState<MarketConfig>(loadConfig);
  const [manualKeys, setManualKeys] = useState<string[]>(loadManual);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);

  const cfgRef = useRef(marketConfig);
  const manRef = useRef(manualKeys);
  const ratesRef = useRef<LiveRates | null>(null);
  cfgRef.current = marketConfig;
  manRef.current = manualKeys;

  const persist = (cfg: MarketConfig, man: string[]) => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    localStorage.setItem(MANUAL_KEY, JSON.stringify(man));
  };

  const setMarketConfig = useCallback((key: keyof MarketConfig, value: number) => {
    setMarketConfigState((prev) => {
      const next = { ...prev, [key]: value };
      const man = manRef.current.includes(key) ? manRef.current : [...manRef.current, key];
      setManualKeys(man);
      persist(next, man);
      return next;
    });
  }, []);

  const resetMarketConfig = useCallback(() => {
    const next = applyLiveRates({ ...DEFAULTS }, ratesRef.current, []);
    setMarketConfigState(next);
    setManualKeys([]);
    persist(next, []);
  }, []);

  const buildCommissions = (cfg: MarketConfig, rates: Awaited<ReturnType<typeof fetchLiveRates>> | null): WalletCommission[] => {
    const now = new Date();
    return [
      { name: "Banco en USD", slug: "mercury", achIncoming: 0, achOutgoing: cfg.mercuryAchOut, wireIncoming: 0, wireOutgoing: cfg.mercuryWireOut, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, lastUpdated: now, feeSource: "official-documentation" },
      { name: "Payoneer", slug: "payoneer", achIncoming: cfg.payoneerAchIn, achOutgoing: cfg.payoneerAchOutFixed, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.payoneer ?? undefined, lastUpdated: now, rateSource: "CCL x 0.99 (estimado)", feeSource: "official-documentation" },
      { name: "GrabrFi", slug: "grabrfi", achIncoming: 0, achOutgoing: cfg.grabrfiAchOutPct, achOutgoingMin: cfg.grabrfiAchOutMin, achOutgoingMax: cfg.grabrfiAchOutMax, wireIncoming: 5, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.grabrfi ?? undefined, lastUpdated: now, rateSource: "Dolar MEP", feeSource: "official-documentation" },
      { name: "Astropay", slug: "astropay", achIncoming: cfg.astropayReceiveFee, achOutgoing: 3.5, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 2.5, monthlyFee: 0, usdToArsRate: cfg.astropayUsdtToArs ?? undefined, lastUpdated: now, rateSource: "CriptoYa", rateIsManual: manRef.current.includes("astropayUsdtToArs") },
      { name: "Belo", slug: "belo", achIncoming: cfg.beloAchInPct, achIncomingMin: cfg.beloAchInMin, achOutgoing: 5, wireIncoming: 20, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: cfg.beloUsdtToArs ?? undefined, lastUpdated: now, rateSource: "CriptoYa", rateIsManual: manRef.current.includes("beloUsdtToArs") },
      { name: "Santander", slug: "santander", achIncoming: 0, achOutgoing: 0, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.santander ?? undefined, lastUpdated: now, rateSource: "Dolar MEP" },
      { name: "Takenos", slug: "takenos", achIncoming: 0, achOutgoing: 0, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: cfg.takenosUsdToArs ?? undefined, lastUpdated: now, rateSource: "TiendaCrypto USDT/ARS (bid), vía CriptoYa", feeSource: "official-documentation", rateIsManual: manRef.current.includes("takenosUsdToArs") },
    ];
  };

  const snapshot = useCallback((cfg: MarketConfig, getResult: (a: number) => ComparisonResult) => {
    try {
      const h: HistoryPoint[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const r = getResult(SNAPSHOT_AMOUNT);
      const best = [r.astropayPath, r.payoneerPath, r.grabrfiPath, r.santanderPath, r.binancePath, r.takenosPath]
        .find((x) => x.id === r.recommendation);
      if (!best || best.finalAmountARS == null) return; // sin tasas en vivo no se registra el punto
      const lr = ratesRef.current;
      h.push({
        t: Date.now(),
        rate: best.finalAmountARS / SNAPSHOT_AMOUNT,
        route: best.id,
        belo: lr?.belo ?? null,
        binance: lr?.binance ?? null,
        mep: lr?.mep ?? null,
      });
      if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch { /* noop */ }
  }, []);

  const calculateComparison = useCallback((amountUSD: number): ComparisonResult => {
    const c = cfgRef.current;
    const list = commissions.length ? commissions : buildCommissions(c, null);
    const bySlug = (s: string) => list.find((w) => w.slug === s)!;
    const mercury = bySlug("mercury");
    const payoneer = bySlug("payoneer");
    const grabrfi = bySlug("grabrfi");
    const beloRate = c.beloUsdtToArs;
    // null si la tasa en vivo no está disponible: la ruta se marca con error, sin valor de respaldo.
    const toARS = (usd: number, rate: number | null | undefined) => (rate ? usd * rate : null);
    const perUSD = (ars: number | null) => (ars == null ? null : ars / amountUSD);

    // R1 AstroPay (Crypto)
    // NOTA: la comisión de conversión de AstroPay (~2.5%) NO se descuenta acá a propósito.
    // `astropayUsdtToArs` viene de CriptoYa `totalBid`, que ya es neto de las comisiones del
    // exchange. Restarla de nuevo sería contarla dos veces. El 2.5% que muestra RatesTable es
    // informativo. Mismo criterio para Binance P2P en R5.
    let a = amountUSD - c.mercuryAchOut;
    const ga = clamp((a * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
    const b = a - ga;
    const cv = (b * c.grabrfiUsdToUsdtPct) / 100;
    const cc = b - cv;
    const wd = (cc * c.grabrfiUsdtWithdrawPct) / 100 + c.grabrfiUsdtWithdrawFixed;
    const d = cc - wd - c.astropayReceiveFee;
    const r1ARS = toARS(d, c.astropayUsdtToArs);
    const astropayPath: TransferPath = {
      id: "astropay", name: "Banco en USD → GrabrFi → USDT → AstroPay", finalAmountARS: r1ARS,
      effectiveRate: perUSD(r1ARS), totalFees: amountUSD - d,
      missingRate: r1ARS == null ? "AstroPay" : undefined,
      transferMethod: "Banco en USD → GrabrFi: ACH  ·  GrabrFi → AstroPay: USDT (Tron/BSC)",
      steps: [
        step("Banco en USD", "GrabrFi", "ach", c.mercuryAchOut, "fixed", amountUSD, a),
        step("GrabrFi ACH out", "GrabrFi", "ach", c.grabrfiAchOutPct, "percentage", a, b),
        step("GrabrFi USD", "GrabrFi USDT", "conversion", c.grabrfiUsdToUsdtPct, "percentage", b, cc),
        step("GrabrFi retiro USDT (fee plataforma)", "Red Cripto", "conversion", wd, "fixed", cc, d),
        step("AstroPay (USDT)", "AstroPay (ARS)", "conversion", c.astropayReceiveFee, "fixed", d, r1ARS),
      ],
    };

    // R5 Binance P2P (misma adquisición de USDT que R1; venta P2P 0% al mejor precio)
    const binanceUSDT = cc - wd;
    const r5ARS = toARS(binanceUSDT, c.binanceUsdtToArs);
    const binancePath: TransferPath = {
      id: "binance", name: "Banco en USD → GrabrFi → USDT → Binance P2P", finalAmountARS: r5ARS,
      effectiveRate: perUSD(r5ARS), totalFees: amountUSD - binanceUSDT,
      missingRate: r5ARS == null ? "Binance P2P" : undefined,
      transferMethod: "Banco en USD → GrabrFi: ACH  ·  GrabrFi → Binance P2P: USDT (Tron/BSC)",
      steps: [
        step("Banco en USD", "GrabrFi", "ach", c.mercuryAchOut, "fixed", amountUSD, a),
        step("GrabrFi ACH out", "GrabrFi", "ach", c.grabrfiAchOutPct, "percentage", a, b),
        step("GrabrFi USD", "GrabrFi USDT", "conversion", c.grabrfiUsdToUsdtPct, "percentage", b, cc),
        step("GrabrFi retiro USDT (fee plataforma)", "Binance (red)", "conversion", wd, "fixed", cc, binanceUSDT),
        step("Binance P2P (USDT→ARS)", "ARS", "conversion", 0, "fixed", binanceUSDT, r5ARS),
      ],
    };

    // R2 Payoneer → Belo
    let p = amountUSD - mercury.achOutgoing;
    const pAfterMercury = p;
    p -= (p * payoneer.achIncoming) / 100;
    const pAfterPayoneerRecv = p;
    // Retiro Payoneer USD→USD (a la cuenta US de Belo): fee FIJO desde mar-2025
    // $1.5 estándar (<$50k/mes); $4 si el monto es < umbral (~$400).
    const pOut = p < c.payoneerSmallThreshold ? c.payoneerAchOutSmall : c.payoneerAchOutFixed;
    p -= pOut;
    const pAfterPayoneerRetiro = p;
    p -= Math.max((p * c.beloAchInPct) / 100, c.beloAchInMin);
    const r2ARS = toARS(p, beloRate);
    const payoneerPath: TransferPath = {
      id: "payoneer", name: "Banco en USD → Payoneer → Belo", finalAmountARS: r2ARS,
      effectiveRate: perUSD(r2ARS), totalFees: amountUSD - p,
      missingRate: r2ARS == null ? "Belo" : undefined,
      transferMethod: "Banco en USD → Payoneer: ACH  ·  Payoneer → Belo: ACH",
      steps: [
        step("Banco en USD", "Payoneer", "ach", mercury.achOutgoing, "fixed", amountUSD, pAfterMercury),
        step("Payoneer recepción", "Payoneer", "ach", payoneer.achIncoming, "percentage", pAfterMercury, pAfterPayoneerRecv),
        step("Payoneer retiro USD", "Belo", "ach", pOut, "fixed", pAfterPayoneerRecv, pAfterPayoneerRetiro),
        step("Belo recepción", "Belo", "ach", c.beloAchInPct, "percentage", pAfterPayoneerRetiro, p),
        step("Belo (USD)", "Belo (ARS)", "conversion", 0, "fixed", p, r2ARS),
      ],
    };

    // R3 GrabrFi → Belo
    let g = amountUSD - mercury.achOutgoing;
    const gAfterMercury = g;
    g -= clamp((g * grabrfi.achOutgoing) / 100, grabrfi.achOutgoingMin!, grabrfi.achOutgoingMax!);
    const gAfterGrabrfi = g;
    g -= Math.max((g * c.beloAchInPct) / 100, c.beloAchInMin);
    const r3ARS = toARS(g, beloRate);
    const grabrfiPath: TransferPath = {
      id: "grabrfi", name: "Banco en USD → GrabrFi → Belo", finalAmountARS: r3ARS,
      effectiveRate: perUSD(r3ARS), totalFees: amountUSD - g,
      missingRate: r3ARS == null ? "Belo" : undefined,
      transferMethod: "Banco en USD → GrabrFi: ACH  ·  GrabrFi → Belo: ACH",
      steps: [
        step("Banco en USD", "GrabrFi", "ach", mercury.achOutgoing, "fixed", amountUSD, gAfterMercury),
        step("GrabrFi", "Belo", "ach", grabrfi.achOutgoing, "percentage", gAfterMercury, gAfterGrabrfi),
        step("Belo recepción", "Belo", "ach", c.beloAchInPct, "percentage", gAfterGrabrfi, g),
        step("Belo (USD)", "Belo (ARS)", "conversion", 0, "fixed", g, r3ARS),
      ],
    };

    // R4 Santander Wire → Dólar MEP (liquidación directa, ¡sin pasar por Belo!)
    // El monto llega a la cuenta USD de Santander vía wire y se convierte directo a ARS
    // operando el dólar MEP ahí mismo. `santander.usdToArsRate` YA es la tasa MEP (ver
    // criptoya.ts: `santander: mep`), así que no hay spread adicional que modelar acá —
    // mismo criterio que R1/R5 con el `totalBid` de CriptoYa.
    const santander = bySlug("santander");
    const s = amountUSD - c.mercuryWireOut;
    const r4ARS = toARS(s, santander.usdToArsRate);
    const santanderPath: TransferPath = {
      id: "santander", name: "Banco en USD Wire → Santander → Dólar MEP", finalAmountARS: r4ARS,
      effectiveRate: perUSD(r4ARS), totalFees: amountUSD - s,
      missingRate: r4ARS == null ? "Dólar MEP" : undefined,
      transferMethod: "Banco en USD → Santander: Wire  ·  Santander → ARS: Dólar MEP",
      steps: [
        step("Banco en USD", "Santander", "wire", c.mercuryWireOut, "fixed", amountUSD, s),
        step("Santander recepción Wire", "Santander", "wire", 0, "fixed", s, s),
        step("Santander (USD)", "ARS (Dólar MEP)", "conversion", 0, "fixed", s, r4ARS),
      ],
    };

    // R6 Takenos (ACH directo, sin intermediarios; 0% en todos los pasos)
    const tk = amountUSD - c.mercuryAchOut;
    const r6ARS = toARS(tk, c.takenosUsdToArs);
    const takenosPath: TransferPath = {
      id: "takenos", name: "Banco en USD → Takenos → CBU/CVU", finalAmountARS: r6ARS,
      effectiveRate: perUSD(r6ARS), totalFees: amountUSD - tk,
      missingRate: r6ARS == null ? "Takenos" : undefined,
      transferMethod: "Banco en USD → Takenos: ACH  ·  Takenos → CBU/CVU: transferencia local",
      steps: [
        step("Banco en USD", "Takenos", "ach", c.mercuryAchOut, "fixed", amountUSD, tk),
        step("Takenos recepción (ACH)", "Takenos", "ach", 0, "percentage", tk, tk),
        step("Takenos (USD)", "CBU/CVU (ARS)", "conversion", 0, "fixed", tk, r6ARS),
      ],
    };

    const paths = [astropayPath, payoneerPath, grabrfiPath, santanderPath, binancePath, takenosPath];
    const best = paths.reduce<TransferPath | null>(
      (m, x) => (x.finalAmountARS != null && (!m || x.finalAmountARS > m.finalAmountARS!) ? x : m), null);
    // Ahorro de la mejor ruta vs. la referencia Banco en USD Wire → Santander → Dólar MEP (R4).
    const savings = best && r4ARS != null ? best.finalAmountARS! - r4ARS : null;

    return {
      astropayPath, payoneerPath, grabrfiPath, santanderPath, binancePath, takenosPath,
      recommendation: (best?.id ?? null) as ComparisonResult["recommendation"],
      savings, savingsPercentage: savings != null && r4ARS ? (savings / r4ARS) * 100 : null,
    };
  }, [commissions]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rates = await fetchLiveRates();
      ratesRef.current = rates;
      setLiveRates(rates);
      const next = applyLiveRates(cfgRef.current, rates, manRef.current);
      cfgRef.current = next;
      setMarketConfigState(next);
      localStorage.setItem(CFG_KEY, JSON.stringify(next));
      setCommissions(buildCommissions(next, rates));
      const missing = missingRates(next, rates);
      setError(missing.length ? `No se pudo obtener la tasa en vivo de: ${missing.join(", ")}.` : null);
      setLastRefresh(new Date());
    } catch (e) {
      const next = applyLiveRates(cfgRef.current, null, manRef.current);
      cfgRef.current = next;
      setMarketConfigState(next);
      setCommissions(buildCommissions(next, null));
      setError("No se pudieron cargar las tasas en vivo.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // snapshot histórico cuando cambian las comisiones
  useEffect(() => {
    if (commissions.length) snapshot(cfgRef.current, calculateComparison);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissions]);

  useEffect(() => {
    refreshData();
    const id = setInterval(refreshData, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") refreshData(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [refreshData]);

  return {
    commissions, isLoading, error, lastRefresh,
    refreshData, calculateComparison,
    marketConfig, setMarketConfig, resetMarketConfig, manualKeys,
    binanceP2p: liveRates?.binance ?? null,
    mep: liveRates?.mep ?? null,
  };
}
