import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import type { ComparisonResult, WalletCommission, TransferPath } from "../types/commission";
import { fmtARS, fmtUSD, fmtNum } from "../lib/format";

interface Props {
  onCalculate: (amount: number) => ComparisonResult;
  santander?: WalletCommission;
}

export default function ArbitrageLoopCalculator({ onCalculate, santander }: Props) {
  const [amount, setAmount] = useState(1000);

  const { best, finalUSD, profit, roi } = useMemo(() => {
    const res = onCalculate(amount || 0);
    const paths: TransferPath[] = [res.astropayPath, res.payoneerPath, res.grabrfiPath, res.santanderPath, res.binancePath];
    const best = paths.reduce((m, x) => (x.finalAmountARS > m.finalAmountARS ? x : m));
    const mep = santander?.usdToArsRate ?? 0;
    const divisor = mep * (1 + (santander?.achOutgoing ?? 0) / 100);
    const finalUSD = divisor ? best.finalAmountARS / divisor : 0;
    const profit = finalUSD - (amount || 0);
    const roi = amount ? (profit / amount) * 100 : 0;
    return { best, finalUSD, profit, roi };
  }, [amount, onCalculate, santander]);

  const pos = profit > 0;

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <RefreshCcw className="h-5 w-5 text-primary" /> Arbitrage Loop Calculator (Bucle / Puré)
      </h3>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">Monto a transferir (USD)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))}
            className="w-full rounded-lg border border-border bg-input px-3.5 py-3 text-base outline-none focus:border-ring" />
        </div>
        <div className="rounded-xl border border-border bg-secondary p-4">
          <div className="text-xs text-muted-foreground">Dólar MEP (Santander)</div>
          <div className="mt-1 text-xl font-extrabold text-primary">
            ${fmtNum(santander?.usdToArsRate)} ARS
          </div>
          <div className="text-xs text-muted-foreground">Auto desde tarjeta Santander</div>
        </div>
        <div className="rounded-xl border border-border bg-secondary p-4">
          <div className="text-xs text-muted-foreground">Fee Operación (Santander)</div>
          <div className="mt-1 text-xl font-extrabold text-primary">
            {(santander?.achOutgoing ?? 0) === 0 ? "Gratis (0%)" : `${santander?.achOutgoing}%`}
          </div>
          <div className="text-xs text-muted-foreground">Auto desde tarjeta Santander</div>
        </div>
      </div>

      <div>
        <Step n="1. Capital Inicial:" v={fmtUSD(amount || 0)} />
        <Step n={`2. Conversión Máxima a Pesos: (${best.name})`} v={fmtARS(best.finalAmountARS)} />
        <Step n="3. Retorno en Dólar MEP:" v={fmtUSD(finalUSD)} />
      </div>

      <div className={`mt-4 rounded-xl border p-5 ${pos ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Resultado del ciclo:</div>
            <div className={`text-3xl font-extrabold ${pos ? "text-success" : "text-destructive"}`}>
              {pos ? "+" : ""}{fmtUSD(profit)}
            </div>
            <div className="text-sm font-semibold">ROI: {pos ? "+" : ""}{roi.toFixed(2)}%</div>
          </div>
          {pos ? <TrendingUp className="h-8 w-8 text-success" /> : <TrendingDown className="h-8 w-8 text-destructive" />}
        </div>
      </div>
    </div>
  );
}

function Step({ n, v }: { n: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-3 text-[15px]">
      <span>{n}</span>
      <span className="text-lg font-extrabold">{v}</span>
    </div>
  );
}
