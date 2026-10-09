import { fmtNum } from "../lib/format";

export interface RateCardData {
  key: string;
  name: string;
  rate?: number | null;
  source?: string;
  isManual?: boolean;
  /** Color del borde, como componentes HSL o variable CSS (ej. "var(--belo)") */
  tone: string;
}

export default function ExchangeRateCard({ card, highlight = false }: { card: RateCardData; highlight?: boolean }) {
  return (
    <div
      className={`glass-card rounded-xl p-5 ${highlight ? "ring-2 ring-success shadow-[0_0_20px_hsl(142_71%_45%/0.35)]" : ""}`}
      style={{ borderLeft: `3px solid hsl(${card.tone})` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{card.name}</span>
        <div className="flex items-center gap-1.5">
          {highlight && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-bold text-success">★ Mejor</span>
          )}
          {card.isManual ? (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">Manual</span>
          ) : card.rate ? (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">en vivo</span>
          ) : (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">error</span>
          )}
        </div>
      </div>
      {card.rate ? (
        <div className="mt-1 text-3xl font-extrabold">${fmtNum(card.rate)}</div>
      ) : (
        <div className="mt-1 text-xl font-extrabold text-destructive">Error: sin tasa en vivo</div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        1 USD → ARS{card.source ? ` · ${card.source}` : ""}
      </div>
    </div>
  );
}
