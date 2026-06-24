import { useState } from "react";
import { createPortal } from "react-dom";
import { Settings2, RotateCcw, X } from "lucide-react";
import type { MarketConfig } from "../hooks/useCommissionData";

const FEE_FIELDS: [keyof MarketConfig, string][] = [
  ["mercuryAchOut", "Mercury ACH out (USD)"],
  ["mercuryWireOut", "Mercury Wire intl (USD)"],
  ["grabrfiAchOutPct", "GrabrFi ACH out %"],
  ["grabrfiAchOutMin", "GrabrFi ACH out mín"],
  ["grabrfiAchOutMax", "GrabrFi ACH out máx"],
  ["grabrfiUsdToUsdtPct", "GrabrFi USD→USDT %"],
  ["grabrfiUsdtWithdrawPct", "GrabrFi USDT withdraw %"],
  ["grabrfiUsdtWithdrawFixed", "GrabrFi USDT withdraw fijo"],
  ["astropayReceiveFee", "AstroPay recepción (USD)"],
  ["beloAchInPct", "Belo ACH in %"],
  ["beloAchInMin", "Belo ACH in mín"],
  ["beloUsdToUsdtSpread", "Belo spread USD→USDT % (Santander)"],
  ["payoneerAchIn", "Payoneer ACH in %"],
  ["payoneerAchOutFixed", "Payoneer retiro USD fijo"],
  ["payoneerAchOutSmall", "Payoneer retiro <umbral (USD)"],
  ["payoneerSmallThreshold", "Payoneer umbral monto chico (USD)"],
];

interface Props {
  config: MarketConfig;
  onChange: (key: keyof MarketConfig, value: number) => void;
  onReset: () => void;
  manualKeys: string[];
}

export default function MarketConfigPanel({ config, onChange, onReset, manualKeys }: Props) {
  const [open, setOpen] = useState(false);
  const field = (arr: [keyof MarketConfig, string][]) =>
    arr.map(([k, label]) => (
      <div key={k} className="mb-3">
        <label className="mb-1 flex items-center justify-between text-sm text-foreground/80">
          {label}
          {manualKeys.includes(k) && (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-bold text-warning">Manual</span>
          )}
        </label>
        <input
          type="number" step="any" value={config[k]}
          onChange={(e) => onChange(k, parseFloat(e.target.value))}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </div>
    ));

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-semibold transition hover:border-primary/60">
        <Settings2 className="h-4 w-4" /> Mercado
      </button>

      {createPortal(
        <>
          <div onClick={() => setOpen(false)}
            className={`fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
          <aside className={`fixed right-0 top-0 z-[110] h-full w-[420px] max-w-[92vw] overflow-y-auto border-l border-border bg-card p-6 transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Mercado</h3>
                <p className="text-sm text-muted-foreground">Comisiones editables</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border p-2"><X className="h-4 w-4" /></button>
            </div>
            <button onClick={onReset}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-semibold">
              <RotateCcw className="h-4 w-4" /> Restablecer valores
            </button>
            <div className="mt-6">
              <h5 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-primary">Comisiones</h5>
              {field(FEE_FIELDS)}
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
