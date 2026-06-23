import type { WalletCommission } from "../types/commission";
import { fmtNum } from "../lib/format";

const TONE: Record<string, string> = {
  mercury: "var(--mercury)", astropay: "var(--astropay)", belo: "var(--belo)",
  payoneer: "var(--payoneer)", grabrfi: "var(--grabrfi)", santander: "var(--santander)",
};

function pct(w: WalletCommission, kind: "in" | "out") {
  const fee = kind === "in" ? w.achIncoming : w.achOutgoing;
  const min = kind === "in" ? w.achIncomingMin : w.achOutgoingMin;
  const max = kind === "in" ? w.achIncomingMax : w.achOutgoingMax;
  if (fee === 0) return "Gratis";
  // tarifas porcentuales conocidas
  if ((w.slug === "grabrfi" && kind === "out") || (w.slug === "belo" && kind === "in")) {
    let s = `${fee}%`;
    if (min != null) s += ` (mín $${min}`;
    if (max != null) s += `, máx $${max}`;
    if (min != null) s += ")";
    return s;
  }
  return `$${fee} USD`;
}

export default function WalletCard({ wallet }: { wallet: WalletCommission }) {
  const color = `hsl(${TONE[wallet.slug]})`;
  return (
    <div className="glass-card rounded-xl p-5" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="mb-3 flex items-center gap-2 font-bold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {wallet.name}
      </div>
      <Row label="ACH Entrada" value={pct(wallet, "in")} />
      <Row label="ACH Salida" value={pct(wallet, "out")} />
      <div className="mt-2 flex justify-between border-t border-border/40 pt-2 text-sm">
        <span className="text-muted-foreground">Tasa USD → ARS</span>
        <span className="font-bold text-primary">{wallet.usdToArsRate ? `$${fmtNum(wallet.usdToArsRate)}` : "—"}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={value === "Gratis" ? "font-semibold text-success" : "font-medium"}>{value}</span>
    </div>
  );
}
