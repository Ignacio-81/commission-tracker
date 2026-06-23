import type { WalletCommission } from "../types/commission";
import { fmtNum } from "../lib/format";

const TONE: Record<string, string> = {
  mercury: "var(--mercury)", astropay: "var(--astropay)", belo: "var(--belo)",
  payoneer: "var(--payoneer)", grabrfi: "var(--grabrfi)", santander: "var(--santander)",
};

export default function ExchangeRateCard({ wallet, highlight = false }: { wallet: WalletCommission; highlight?: boolean }) {
  return (
    <div
      className={`glass-card rounded-xl p-5 ${highlight ? "ring-2 ring-success shadow-[0_0_20px_hsl(142_71%_45%/0.35)]" : ""}`}
      style={{ borderLeft: `3px solid hsl(${TONE[wallet.slug]})` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{wallet.name}</span>
        <div className="flex items-center gap-1.5">
          {highlight && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-bold text-success">★ Mejor</span>
          )}
          {wallet.rateIsManual ? (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">Manual</span>
          ) : (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">en vivo</span>
          )}
        </div>
      </div>
      <div className="mt-1 text-3xl font-extrabold">
        {wallet.usdToArsRate ? `$${fmtNum(wallet.usdToArsRate)}` : "—"}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        1 USD → ARS{wallet.rateSource ? ` · ${wallet.rateSource}` : ""}
      </div>
    </div>
  );
}
