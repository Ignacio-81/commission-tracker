import type { WalletCommission } from "../types/commission";
import { fmtNum } from "../lib/format";

const TONE: Record<string, string> = {
  mercury: "var(--mercury)", astropay: "var(--astropay)", belo: "var(--belo)",
  payoneer: "var(--payoneer)", grabrfi: "var(--grabrfi)", santander: "var(--santander)",
  takenos: "var(--takenos)",
};

const cell = (n: number, suffix = " USD") => (n === 0 ? "Gratis" : `$${n}${suffix}`);

export default function RatesTable({ commissions }: { commissions: WalletCommission[] }) {
  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-4 text-xl font-bold">Tabla comparativa</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="border-b border-border/40 p-3 text-left">Billetera</th>
              <th className="border-b border-border/40 p-3 text-right">ACH Entrada</th>
              <th className="border-b border-border/40 p-3 text-right">ACH Salida</th>
              <th className="border-b border-border/40 p-3 text-right">Conversión</th>
              <th className="border-b border-border/40 p-3 text-right">Mensual</th>
              <th className="border-b border-border/40 p-3 text-right">Tasa USD→ARS</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((w) => (
              <tr key={w.slug}>
                <td className="border-b border-border/40 p-3">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${TONE[w.slug]})` }} />
                    {w.name}
                  </span>
                </td>
                <Td>{w.achIncoming === 0 ? <Free /> : `${w.achIncoming}${w.achIncomingMin != null ? "%" : " USD"}`}</Td>
                <Td>{w.achOutgoing === 0 ? <Free /> : `${w.achOutgoing}${w.achOutgoingMin != null ? "%" : " USD"}`}</Td>
                <Td>
                  {w.conversionFee === 0 ? <Free /> : (
                    <span title="Ya incluida en la tasa de CriptoYa (totalBid es neto de comisiones); no se descuenta aparte en el cálculo de rutas.">
                      {w.conversionFee}% <span className="text-muted-foreground">*</span>
                    </span>
                  )}
                </Td>
                <Td>{w.monthlyFee === 0 ? <Free /> : cell(w.monthlyFee)}</Td>
                <Td>{w.usdToArsRate ? fmtNum(w.usdToArsRate) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          * La comisión de conversión ya está incluida en la tasa que devuelve CriptoYa
          (<code>totalBid</code> es neto de comisiones del exchange), por eso no se descuenta
          otra vez en el cálculo de rutas.
        </p>
      </div>
    </div>
  );
}

const Td = ({ children }: { children: React.ReactNode }) => (
  <td className="border-b border-border/40 p-3 text-right">{children}</td>
);
const Free = () => <span className="font-semibold text-success">Gratis</span>;
