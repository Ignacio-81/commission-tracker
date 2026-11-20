import { Check } from "lucide-react";
import { SELECTABLE_WALLETS, type EnabledWallets, type SelectableWallet } from "../lib/wallets";

interface Props {
  enabled: EnabledWallets;
  onToggle: (id: SelectableWallet, on: boolean) => void;
}

// Elige qué billeteras/bancos de destino entran en el cálculo. Las no seleccionadas se ocultan.
export default function WalletSelector({ enabled, onToggle }: Props) {
  const count = SELECTABLE_WALLETS.filter((w) => enabled[w.id]).length;
  return (
    <section className="glass-card rounded-xl p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Billeteras y bancos en el cálculo</h3>
        <span className="text-xs text-muted-foreground">{count} de {SELECTABLE_WALLETS.length} seleccionadas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SELECTABLE_WALLETS.map((w) => {
          const on = enabled[w.id];
          return (
            <button
              key={w.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(w.id, !on)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                on ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground line-through opacity-70 hover:opacity-100"
              }`}
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{ background: on ? `hsl(${w.tone})` : "transparent", border: `2px solid hsl(${w.tone})` }}
              >
                {on && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
              </span>
              {w.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
