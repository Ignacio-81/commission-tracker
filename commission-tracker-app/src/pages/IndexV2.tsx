import { useMemo, useState } from "react";
import { AlertCircle, Trophy, ArrowRight, TrendingUp } from "lucide-react";
import { useCommissionData } from "../hooks/useCommissionData";
import { fmtARS, fmtNum } from "../lib/format";
import { optimizeRoutes, type RouteResult, type Unit } from "../lib/routeOptimizer";
import Header from "../components/Header";
import MarketConfigPanel from "../components/MarketConfigPanel";

// ─────────────────────────────────────────────────────────────────────────────
// v2 — Optimizador de rutas
// Dado un monto en USD en Mercury, calcula TODAS las combinaciones de billeteras
// posibles (origen siempre Mercury; salida solo por GrabrFi o Payoneer; resto
// libre) y muestra la que deja el mayor monto final en ARS.
// ─────────────────────────────────────────────────────────────────────────────

const fmtUnit = (n: number, unit: Unit) =>
  unit === "ARS" ? fmtARS(n) : `${fmtNum(n)} ${unit}`;

export default function IndexV2() {
  const {
    isLoading, error, lastRefresh, refreshData,
    marketConfig, setMarketConfig, resetMarketConfig, manualKeys,
  } = useCommissionData();

  const [amount, setAmount] = useState<number>(1000);

  const routes = useMemo(
    () => (amount > 0 ? optimizeRoutes(amount, marketConfig) : []),
    [amount, marketConfig],
  );

  const best = routes[0];
  const rest = routes.slice(1);

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

      <main className="mx-auto max-w-4xl space-y-8 px-5 pb-20">
        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" /> {error}
          </div>
        )}

        <section className="pt-12 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            La <span className="gradient-text">mejor combinación</span> para tus dólares
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/60">
            Ingresá el monto en USD en Mercury y el optimizador calcula todas las rutas posibles
            para devolverte la que maximiza tus pesos.
          </p>
        </section>

        {/* Input de monto */}
        <section className="glass-card rounded-2xl p-6">
          <label className="block text-sm font-semibold text-muted-foreground">
            Monto a transferir (USD desde Mercury)
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-2xl font-bold outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        {/* Mejor combinación */}
        {best && (
          <section className="glass-card glow-success rounded-2xl border-l-4 border-success p-6">
            <div className="flex items-center gap-2 text-success">
              <Trophy className="h-5 w-5" />
              <span className="text-sm font-bold uppercase tracking-wide">Mejor combinación</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold">
              {best.name.split(" → ").map((node, i, arr) => (
                <span key={i} className="flex items-center gap-2">
                  {node}
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Recibís</div>
                <div className="text-4xl font-extrabold text-success">{fmtARS(best.finalARS)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tasa efectiva</div>
                <div className="text-4xl font-extrabold">
                  {fmtNum(best.effectiveRate)} <span className="text-lg font-medium text-muted-foreground">ARS/USD</span>
                </div>
              </div>
            </div>

            {/* Desglose paso a paso */}
            <div className="mt-6 border-t border-border/50 pt-4">
              <div className="mb-3 text-sm font-semibold text-muted-foreground">Desglose paso a paso</div>
              <ol className="space-y-2">
                {best.steps.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-4 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                      {s.label}
                    </span>
                    <span className="flex items-center gap-3 text-right">
                      <span className="text-xs text-muted-foreground">{s.fee}</span>
                      <span className="font-semibold tabular-nums">{fmtUnit(s.amountOut, s.unit)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* Resto de rutas, ordenadas */}
        {rest.length > 0 && best && (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Otras rutas (de mejor a peor)
            </div>
            <div className="space-y-2">
              {rest.map((r: RouteResult, i) => {
                const diff = best.finalARS - r.finalARS;
                return (
                  <div key={r.id} className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">
                        <span className="mr-2 text-muted-foreground">#{i + 2}</span>{r.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtNum(r.effectiveRate)} ARS/USD</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{fmtARS(r.finalARS)}</div>
                      <div className="text-xs text-destructive">−{fmtARS(diff)} vs. la mejor</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          Optimizador de grafo: enumera todas las combinaciones (origen Mercury; salida vía GrabrFi o Payoneer)
          y elige la de mayor ARS final. Comisiones y tasas idénticas a la v1 (auditadas, jun-2026); ajustables en el panel ⚙️ Mercado.<br />
          Herramienta informativa — no constituye asesoramiento financiero. Verificá comisiones antes de operar.
        </footer>
      </main>
    </div>
  );
}
