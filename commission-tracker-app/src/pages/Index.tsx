import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { useCommissionData } from "../hooks/useCommissionData";
import { REFERENCE_AMOUNT_USD as REF_AMOUNT } from "../lib/settings";
import Header from "../components/Header";
import ExchangeRateCard, { type RateCardData } from "../components/ExchangeRateCard";
import type { WalletCommission } from "../types/commission";
import MarketConfigPanel from "../components/MarketConfigPanel";
import ComparisonCalculator from "../components/ComparisonCalculator";
import ArbitrageLoopCalculator from "../components/ArbitrageLoopCalculator";
import HistoryChart from "../components/HistoryChart";
import AlertsBanner from "../components/AlertsBanner";


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
  const takenos = find("takenos");

  // Mejor conversión USD→ARS entre las tasas mostradas (incluye Binance P2P)
  const bestRate = useMemo(() => {
    const vals = [
      binanceP2p,
      astropay?.usdToArsRate,
      belo?.usdToArsRate,
      santander?.usdToArsRate,
      takenos?.usdToArsRate,
    ].filter((v): v is number => typeof v === "number" && v > 0);
    return vals.length ? Math.max(...vals) : null;
  }, [binanceP2p, astropay, belo, santander, takenos]);
  // Todas las tasas USD→ARS con la misma jerarquía, de mayor a menor;
  // las que no tienen tasa van al final
  const rateCards = useMemo<RateCardData[]>(() => {
    const fromWallet = (w?: WalletCommission): RateCardData[] =>
      w ? [{ key: w.slug, name: w.name, rate: w.usdToArsRate, source: w.rateSource, isManual: w.rateIsManual, tone: `var(--${w.slug})` }] : [];
    return [
      ...fromWallet(astropay),
      ...fromWallet(belo),
      ...fromWallet(santander),
      ...fromWallet(takenos),
      { key: "binance", name: "Binance P2P", rate: binanceP2p, source: "CriptoYa (P2P bid)", tone: "38 92% 50%" },
    ].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  }, [astropay, belo, santander, takenos, binanceP2p]);

  const isBest = (rate?: number | null) =>
    bestRate != null && rate != null && rate === bestRate;

  // ROI del arbitraje MEP para el monto de referencia (para las alertas)
  const arbRoi = useMemo(() => {
    if (!commissions.length || !santander?.usdToArsRate) return -Infinity;
    const r = calculateComparison(REF_AMOUNT);
    const best = [r.astropayPath, r.payoneerPath, r.grabrfiPath, r.santanderPath, r.binancePath, r.takenosPath]
      .find((x) => x.id === r.recommendation);
    if (!best || best.finalAmountARS == null) return -Infinity;
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
            Wallet <span className="gradient-text">Path</span> Tracker
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/60">
            Compara y ahorra en tus movimientos
          </p>
        </section>

        {commissions.length > 0 && Number.isFinite(arbRoi) && (
          <AlertsBanner roi={arbRoi} refreshKey={lastRefresh?.getTime() ?? 0} />
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {rateCards.map((c) => (
            <ExchangeRateCard key={c.key} card={c} highlight={isBest(c.rate)} />
          ))}
        </section>

        <ComparisonCalculator onCalculate={calculateComparison} />

        <HistoryChart tick={lastRefresh?.getTime() ?? 0} />

        <ArbitrageLoopCalculator onCalculate={calculateComparison} santander={santander} />

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          Tasas FX en vivo vía CriptoYa (Belo USDC/ARS y AstroPay USDT/ARS = bid real; MEP/CCL = AL30 24hs). Las ediciones manuales del panel de Mercado tienen precedencia y se marcan "Manual".<br />
          Comisiones verificadas con fuentes oficiales (jun-2026): Banco en USD, GrabrFi, Belo y Payoneer ✓. Estimados sin tarifa pública: AstroPay (recepción/conversión) y GrabrFi USD→USDT — ajustables en el panel. Takenos: 0% en los tres pasos según la ficha del proveedor; la tasa se toma del bid de TiendaCrypto (USDT/ARS vía CriptoYa), su proveedor de liquidez, porque Takenos no publica una API de tasas propia.<br />
          Herramienta informativa — no constituye asesoramiento financiero. Verificá comisiones antes de operar.
        </footer>
      </main>
    </div>
  );
}
