import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { ComparisonResult, TransferPath, TransferStep } from "../types/commission";
import { fmtARS, fmtUSD, fmtNum } from "../lib/format";

interface Props {
  onCalculate: (amount: number) => ComparisonResult;
}

function deduction(s: TransferStep) {
  if (s.feeType === "percentage" && s.fee > 0) return `-${fmtUSD((s.amount * s.fee) / 100)} (${s.fee}%)`;
  if (s.feeType === "fixed") return s.fee > 0 ? `-${fmtUSD(s.fee)}` : "-US$ 0,00";
  return "—";
}

export default function ComparisonCalculator({ onCalculate }: Props) {
  const [amount, setAmount] = useState(1000);
  const result = useMemo(() => onCalculate(amount || 0), [amount, onCalculate]);
  const paths: TransferPath[] = [result.astropayPath, result.payoneerPath, result.grabrfiPath, result.santanderPath, result.binancePath];

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-4 text-xl font-bold">🧮 Calculadora de Transferencias</h3>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-sm text-muted-foreground">Monto a transferir (USD)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))}
            className="w-full rounded-lg border border-border bg-input px-3.5 py-3 text-base outline-none focus:border-ring" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {paths.map((p) => {
          const best = result.recommendation === p.id;
          return (
            <div key={p.id}
              className={`rounded-xl border p-4 ${best ? "border-success bg-success/10" : "border-border/60 bg-card/50"}`}>
              <h4 className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
                {p.name}
                {best && <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">↗ Mejor</span>}
              </h4>
              <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">{p.transferMethod}</p>
              {p.steps.map((s, i) => (
                <div key={i} className="flex justify-between gap-2 py-1 text-[12.5px] text-foreground/70">
                  <span>{s.from}{s.to && s.to !== s.from ? ` → ${s.to}` : ""}</span>
                  <span className="whitespace-nowrap font-semibold text-destructive">{deduction(s)}</span>
                </div>
              ))}
              <div className="mt-3 border-t border-border/50 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="text-xl font-extrabold">{fmtARS(p.finalAmountARS)}</span>
                </div>
                <div className="mt-0.5 text-right text-xs text-primary">
                  1 USD = {fmtNum(p.finalAmountARS / (amount || 1))} ARS
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-success/40 bg-success/10 px-6 py-4">
        <div>
          <div className="text-sm text-muted-foreground">Ahorro usando la mejor ruta:</div>
          <div className="text-2xl font-extrabold text-success">
            +{fmtARS(result.savings)} ({result.savingsPercentage.toFixed(2)}%)
          </div>
        </div>
        <TrendingUp className="h-7 w-7 text-success" />
      </div>
    </div>
  );
}
