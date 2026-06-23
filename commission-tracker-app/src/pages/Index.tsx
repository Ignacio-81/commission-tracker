import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { useCommissionData } from "../hooks/useCommissionData";
import { fmtNum } from "../lib/format";
import Header from "../components/Header";
import ExchangeRateCard from "../components/ExchangeRateCard";
import TransferFlowDiagram from "../components/TransferFlowDiagram";
import MarketConfigPanel from "../components/MarketConfigPanel";
import ComparisonCalculator from "../components/ComparisonCalculator";
import ArbitrageLoopCalculator from "../components/ArbitrageLoopCalculator";
import HistoryChart from "../components/HistoryChart";
import AlertsBanner from "../components/AlertsBanner";

const REF_AMOUNT = 1000;

export default function Index() {
  const {
    commissions, isLoading, error, lastRefresh,
    refreshData, calculateComparison,
    marketConfig, setMarketConfig, resetMarketConfig, manualKeys,
    binanceP2p,
  } = useCommissionData();

  const find = (slug: string) => commissions.find((w) => w.slug === slug);
  const astropay = find("astropay");
  const belo = find("belo");
  const santander = find("santander");

  // Mejor conversión USD→ARS entre las tasas mostradas (incluye Binance P2P)
  const bestRate = useMemo(() => {
    const vals = [
      binanceP2p,
      astropay?.usdToArsRate,
      belo?.usdToArsRate,
      santander?.usdToArsRate,
    ].filter((v): v is number => typeof v === "number" && v > 0);
    return vals.length ? Math.max(...vals) : null;
  }, [binanceP2p, astropay, belo, santander]);
  const isBest = (rate?: number | null) =>
    bestRate != null && rate != null && rate === bestRate;

  // ROI del arbitraje MEP para el monto de referencia (para las alertas)
  const arbRoi = useMemo(() => {
    if (!commissions.length || !santander?.usdToArsRate) return -Infinity;
    const r = calculateComparison(REF_AMOUNT);
    const best = [r.astropayPath, r.payoneerPath, r.grabrfiPath, r.santanderPath, r.binancePath]
      .reduce((m, x) => (x.finalAmountARS > m.finalAmountARS ? x : m));
    const divisor = santander.usdToArsRate * (1 + (santander.achOutgoing ?? 0) / 100);
    const finalUSD = divisor ? best.finalAmountARS / divisor : 0;
    return ((finalUSD - REF_AMOUNT) / REF_AMOUNT) * 100;
  }, [commissions, calculateComparison, santander]);

  return (
    <div className="min-h-screen">
      <Header
        lastRefresh={lastRefresh}
        isLoading={isLoading}
        onRefresh={refreshData}
        rightSlot={
          <MarketConfigPanel
            config={marketConfig}
            onChange={setMarketConfig}
            onReset={resetMarketConfig}
            manualKeys={manualKeys}
          />
        }
      />

      <main className="mx-auto max-w-7xl space-y-8 px-5 pb-20">
        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" /> {error}
          </div>
        )}

        <section className="pt-12 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Compara y <span className="gradient-text">ahorra</span> en tus transferencias
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/60">
            Analiza las comisiones y tasas de cambio de Mercury, Astropay y Belo para encontrar la mejor ruta para tus dólares.
          </p>
        </section>

        {commissions.length > 0 && Number.isFinite(arbRoi) && (
          <AlertsBanner roi={arbRoi} refreshKey={lastRefresh?.getTime() ?? 0} />
        )}

        <section
          className={`glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5 ${isBest(binanceP2p) ? "ring-2 ring-success shadow-[0_0_20px_hsl(142_71%_45%/0.35)]" : ""}`}
          style={{ borderLeft: "3px solid hsl(38 92% 50%)" }}>
          <div>
            <span className="text-sm text-muted-foreground">Binance P2P · USDT/ARS</span>
            <div className="mt-1 text-3xl font-extrabold">
              {binanceP2p ? `$${fmtNum(binanceP2p)}` : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">1 USD → ARS · CriptoYa (P2P bid)</div>
          </div>
          <div className="flex items-center gap-1.5">
            {isBest(binanceP2p) && (
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-bold text-success">★ Mejor</span>
            )}
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">en vivo</span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {astropay && <ExchangeRateCard wallet={astropay} highlight={isBest(astropay.usdToArsRate)} />}
          {belo && <ExchangeRateCard wallet={belo} highlight={isBest(belo.usdToArsRate)} />}
          {santander && <ExchangeRateCard wallet={santander} highlight={isBest(santander.usdToArsRate)} />}
        </section>

        <TransferFlowDiagram />

        <ComparisonCalculator onCalculate={calculateComparison} />

        <HistoryChart tick={lastRefresh?.getTime() ?? 0} />

        <ArbitrageLoopCalculator onCalculate={calculateComparison} santander={santander} />

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          Tasas FX en vivo vía CriptoYa (Belo USDC/ARS y AstroPay USDT/ARS = bid real; MEP/CCL = AL30 24hs). Las ediciones manuales del panel de Mercado tienen precedencia y se marcan "Manual".<br />
          Comisiones verificadas con fuentes oficiales (jun-2026): Mercury, GrabrFi, Belo y Payoneer ✓. Estimados sin tarifa pública: AstroPay (recepción/conversión) y GrabrFi USD→USDT — ajustables en el panel.<br />
          Herramienta informativa — no constituye asesoramiento financiero. Verificá comisiones antes de operar.
        </footer>
      </main>
    </div>
  );
}
