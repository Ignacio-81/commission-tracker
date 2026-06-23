import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveRates, type LiveRates } from "../lib/criptoya";
import type {
  WalletCommission,
  TransferPath,
  TransferStep,
  ComparisonResult,
} from "../types/commission";

export interface MarketConfig {
  astropayUsdToArs: number;
  astropayUsdtToArs: number;
  beloUsdtToArs: number;
  binanceUsdtToArs: number;
  takenosUsdToArs: number;
  mercuryAchOut: number;
  mercuryWireOut: number;
  grabrfiAchOutPct: number;
  grabrfiAchOutMin: number;
  grabrfiAchOutMax: number;
  grabrfiUsdToUsdtPct: number;
  grabrfiUsdtWithdrawPct: number;
  grabrfiUsdtWithdrawFixed: number;
  astropayReceiveFee: number;
  beloAchInPct: number;
  beloAchInMin: number;
  beloUsdToUsdtSpread: number;
  payoneerAchIn: number;
  payoneerAchOutFixed: number;
  payoneerAchOutSmall: number;
  payoneerSmallThreshold: number;
}

const DEFAULTS: MarketConfig = {
  astropayUsdToArs: 1474,
  astropayUsdtToArs: 1475,
  beloUsdtToArs: 1470,
  binanceUsdtToArs: 1500,
  takenosUsdToArs: 1460,
  mercuryAchOut: 0,
  mercuryWireOut: 15,
  grabrfiAchOutPct: 0.3,
  grabrfiAchOutMin: 1,
  grabrfiAchOutMax: 5,
  grabrfiUsdToUsdtPct: 0.8,
  grabrfiUsdtWithdrawPct: 1.1,
  grabrfiUsdtWithdrawFixed: 1,
  astropayReceiveFee: 0,
  beloAchInPct: 0.3,
  beloAchInMin: 0.5,
  beloUsdToUsdtSpread: 4,
  payoneerAchIn: 1,
  payoneerAchOutFixed: 1.5,
  payoneerAchOutSmall: 4,
  payoneerSmallThreshold: 400,
};

const CFG_KEY = "marketConfig.v1";
const MANUAL_KEY = "marketConfig.manualKeys.v1";
const HISTORY_KEY = "history.v1";

const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
const step = (
  from: string, to: string, type: TransferStep["type"],
  fee: number, feeType: TransferStep["feeType"], amount: number, resultAmount: number,
): TransferStep => ({ from, to, type, fee, feeType, amount, resultAmount });

export interface HistoryPoint {
  t: number;
  rate: number;
  route: string;
  belo?: number | null;
  binance?: number | null;
  mep?: number | null;
}

function loadConfig(): MarketConfig {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
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
    setMarketConfigState({ ...DEFAULTS });
    setManualKeys([]);
    persist({ ...DEFAULTS }, []);
  }, []);

  const buildCommissions = (cfg: MarketConfig, rates: Awaited<ReturnType<typeof fetchLiveRates>> | null): WalletCommission[] => {
    const now = new Date();
    return [
      { name: "Mercury", slug: "mercury", achIncoming: 0, achOutgoing: cfg.mercuryAchOut, wireIncoming: 0, wireOutgoing: cfg.mercuryWireOut, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, lastUpdated: now, feeSource: "official-documentation" },
      { name: "Payoneer", slug: "payoneer", achIncoming: cfg.payoneerAchIn, achOutgoing: cfg.payoneerAchOutFixed, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.payoneer ?? undefined, lastUpdated: now, rateSource: "CCL x 0.99 (estimado)", feeSource: "official-documentation" },
      { name: "GrabrFi", slug: "grabrfi", achIncoming: 0, achOutgoing: cfg.grabrfiAchOutPct, achOutgoingMin: cfg.grabrfiAchOutMin, achOutgoingMax: cfg.grabrfiAchOutMax, wireIncoming: 5, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.grabrfi ?? undefined, lastUpdated: now, rateSource: "Dolar MEP", feeSource: "official-documentation" },
      { name: "Astropay", slug: "astropay", achIncoming: cfg.astropayReceiveFee, achOutgoing: 3.5, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 2.5, monthlyFee: 0, usdToArsRate: cfg.astropayUsdtToArs, lastUpdated: now, rateSource: "CriptoYa", rateIsManual: manRef.current.includes("astropayUsdtToArs") },
      { name: "Belo", slug: "belo", achIncoming: cfg.beloAchInPct, achIncomingMin: cfg.beloAchInMin, achOutgoing: 5, wireIncoming: 20, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: cfg.beloUsdtToArs, lastUpdated: now, rateSource: "CriptoYa", rateIsManual: manRef.current.includes("beloUsdtToArs") },
      { name: "Santander", slug: "santander", achIncoming: 0, achOutgoing: 0, wireIncoming: 0, wireOutgoing: 0, internalTransfer: 0, conversionFee: 0, monthlyFee: 0, usdToArsRate: rates?.santander ?? cfg.beloUsdtToArs, lastUpdated: now, rateSource: "Dolar MEP" },
    ];
  };

  const snapshot = useCallback((cfg: MarketConfig, getResult: (a: number) => ComparisonResult) => {
    try {
      const h: HistoryPoint[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const r = getResult(1000);
      const best = [r.astropayPath, r.payoneerPath, r.grabrfiPath, r.santanderPath, r.binancePath]
        .reduce((m, x) => (x.finalAmountARS > m.finalAmountARS ? x : m));
      const lr = ratesRef.current;
      h.push({
        t: Date.now(),
        rate: best.finalAmountARS / 1000,
        route: r.recommendation,
        belo: lr?.belo ?? cfg.beloUsdtToArs ?? null,
        binance: lr?.binance ?? null,
        mep: lr?.mep ?? null,
      });
      if (h.length > 500) h.shift();
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
    const belo = bySlug("belo");
    const beloRate = c.beloUsdtToArs;

    // R1 AstroPay (Crypto)
    let a = amountUSD - c.mercuryAchOut;
    const ga = clamp((a * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
    const b = a - ga;
    const cv = (b * c.grabrfiUsdToUsdtPct) / 100;
    const cc = b - cv;
    const wd = (cc * c.grabrfiUsdtWithdrawPct) / 100 + c.grabrfiUsdtWithdrawFixed;
    const d = cc - wd - c.astropayReceiveFee;
    const r1ARS = d * c.astropayUsdtToArs;
    const astropayPath: TransferPath = {
      id: "astropay", name: "Mercury → GrabrFi → USDT → AstroPay", finalAmountARS: r1ARS,
      effectiveRate: r1ARS / amountUSD, totalFees: amountUSD - d,
      steps: [
        step("Mercury", "GrabrFi", "ach", c.mercuryAchOut, "fixed", amountUSD, a),
        step("GrabrFi ACH out", "GrabrFi", "ach", c.grabrfiAchOutPct, "percentage", a, b),
        step("GrabrFi USD", "GrabrFi USDT", "conversion", c.grabrfiUsdToUsdtPct, "percentage", b, cc),
        step("GrabrFi USDT", "Red Cripto", "conversion", wd, "fixed", cc, d),
        step("AstroPay (USDT)", "AstroPay (ARS)", "conversion", c.astropayReceiveFee, "fixed", d, r1ARS),
      ],
    };

    // R5 Binance P2P (misma adquisición de USDT que R1; venta P2P 0% al mejor precio)
    const binanceUSDT = cc - wd;
    const r5ARS = binanceUSDT * c.binanceUsdtToArs;
    const binancePath: TransferPath = {
      id: "binance", name: "Mercury → GrabrFi → USDT → Binance P2P", finalAmountARS: r5ARS,
      effectiveRate: r5ARS / amountUSD, totalFees: amountUSD - binanceUSDT,
      steps: [
        step("Mercury", "GrabrFi", "ach", c.mercuryAchOut, "fixed", amountUSD, a),
        step("GrabrFi ACH out", "GrabrFi", "ach", c.grabrfiAchOutPct, "percentage", a, b),
        step("GrabrFi USD", "GrabrFi USDT", "conversion", c.grabrfiUsdToUsdtPct, "percentage", b, cc),
        step("GrabrFi USDT", "Binance (red)", "conversion", wd, "fixed", cc, binanceUSDT),
        step("Binance P2P (USDT→ARS)", "ARS", "conversion", 0, "fixed", binanceUSDT, r5ARS),
      ],
    };

    // R2 Payoneer → Belo
    let p = amountUSD - mercury.achOutgoing;
    p -= (p * payoneer.achIncoming) / 100;
    // Retiro Payoneer USD→USD (a la cuenta US de Belo): fee FIJO desde mar-2025
    // $1.5 estándar (<$50k/mes); $4 si el monto es < umbral (~$400).
    const pOut = p < c.payoneerSmallThreshold ? c.payoneerAchOutSmall : c.payoneerAchOutFixed;
    p -= pOut;
    p -= Math.max((p * c.beloAchInPct) / 100, c.beloAchInMin);
    const r2ARS = p * (belo.usdToArsRate ?? beloRate);
    const payoneerPath: TransferPath = {
      id: "payoneer", name: "Mercury → Payoneer → Belo", finalAmountARS: r2ARS,
      effectiveRate: r2ARS / amountUSD, totalFees: amountUSD - p,
      steps: [
        step("Mercury", "Payoneer", "ach", mercury.achOutgoing, "fixed", amountUSD, amountUSD - mercury.achOutgoing),
        step("Payoneer recepción", "Payoneer", "ach", payoneer.achIncoming, "percentage", amountUSD - mercury.achOutgoing, 0),
        step("Payoneer retiro USD", "Belo", "ach", pOut, "fixed", 0, 0),
        step("Belo recepción", "Belo", "ach", c.beloAchInPct, "percentage", 0, p),
        step("Belo (USD)", "Belo (ARS)", "conversion", 0, "fixed", p, r2ARS),
      ],
    };

    // R3 GrabrFi → Belo
    let g = amountUSD - mercury.achOutgoing;
    g -= clamp((g * grabrfi.achOutgoing) / 100, grabrfi.achOutgoingMin!, grabrfi.achOutgoingMax!);
    g -= Math.max((g * c.beloAchInPct) / 100, c.beloAchInMin);
    const r3ARS = g * (belo.usdToArsRate ?? beloRate);
    const grabrfiPath: TransferPath = {
      id: "grabrfi", name: "Mercury → GrabrFi → Belo", finalAmountARS: r3ARS,
      effectiveRate: r3ARS / amountUSD, totalFees: amountUSD - g,
      steps: [
        step("Mercury", "GrabrFi", "ach", mercury.achOutgoing, "fixed", amountUSD, amountUSD - mercury.achOutgoing),
        step("GrabrFi", "Belo", "ach", grabrfi.achOutgoing, "percentage", amountUSD - mercury.achOutgoing, 0),
        step("Belo recepción", "Belo", "ach", c.beloAchInPct, "percentage", 0, g),
        step("Belo (USD)", "Belo (ARS)", "conversion", 0, "fixed", g, r3ARS),
      ],
    };

    // R4 Santander Wire → Belo  (¡sin paso USDT→ARS!)
    let s = amountUSD - c.mercuryWireOut;
    const spreadFee = (s * c.beloUsdToUsdtSpread) / 100;
    s -= spreadFee;
    const r4ARS = s * (belo.usdToArsRate ?? beloRate);
    const santanderPath: TransferPath = {
      id: "santander", name: "Mercury Wire → Santander → Belo", finalAmountARS: r4ARS,
      effectiveRate: r4ARS / amountUSD, totalFees: amountUSD - s,
      steps: [
        step("Mercury", "Santander", "wire", c.mercuryWireOut, "fixed", amountUSD, amountUSD - c.mercuryWireOut),
        step("Santander recepción Wire", "Santander", "wire", 0, "fixed", amountUSD - c.mercuryWireOut, amountUSD - c.mercuryWireOut),
        step("Santander (USD)", "Belo (USD)", "internal", 0, "fixed", amountUSD - c.mercuryWireOut, amountUSD - c.mercuryWireOut),
        step("Spread local USD→USDT", "Belo", "conversion", c.beloUsdToUsdtSpread, "percentage", amountUSD - c.mercuryWireOut, s),
        step("Belo (USD)", "Belo (ARS)", "conversion", 0, "fixed", s, r4ARS),
      ],
    };

    const paths = [astropayPath, payoneerPath, grabrfiPath, santanderPath, binancePath];
    const best = paths.reduce((m, x) => (x.finalAmountARS > m.finalAmountARS ? x : m));
    const worst = paths.reduce((m, x) => (x.finalAmountARS < m.finalAmountARS ? x : m));
    const savings = best.finalAmountARS - worst.finalAmountARS;

    return {
      astropayPath, payoneerPath, grabrfiPath, santanderPath, binancePath,
      recommendation: best.id as ComparisonResult["recommendation"],
      savings, savingsPercentage: (savings / best.finalAmountARS) * 100,
    };
  }, [commissions]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rates = await fetchLiveRates();
      ratesRef.current = rates;
      setLiveRates(rates);
      const man = manRef.current;
      setMarketConfigState((prev) => {
        const next = { ...prev };
        if (!man.includes("astropayUsdtToArs") && rates.astropay) next.astropayUsdtToArs = rates.astropay;
        if (!man.includes("astropayUsdToArs") && rates.astropay) next.astropayUsdToArs = rates.astropay;
        if (!man.includes("beloUsdtToArs") && rates.belo) next.beloUsdtToArs = rates.belo;
        if (!man.includes("binanceUsdtToArs") && rates.binance) next.binanceUsdtToArs = rates.binance;
        cfgRef.current = next;
        localStorage.setItem(CFG_KEY, JSON.stringify(next));
        setCommissions(buildCommissions(next, rates));
        return next;
      });
      setLastRefresh(new Date());
    } catch (e) {
      setError("No se pudieron cargar tasas en vivo. Mostrando últimos valores guardados.");
      setCommissions((prev) => (prev.length ? prev : buildCommissions(cfgRef.current, null)));
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
