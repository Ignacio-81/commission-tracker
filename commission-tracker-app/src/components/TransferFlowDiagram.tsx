import { ArrowRight } from "lucide-react";

type Node = { c: string; l: string; t: string };

const ROUTES: Node[][] = [
  [{ c: "$", l: "Mercury", t: "--mercury" }, { c: "GF", l: "GrabrFi", t: "--grabrfi" }, { c: "₮", l: "USDT (Tron/BSC)", t: "--success" }, { c: "AP", l: "AstroPay", t: "--astropay" }, { c: "$", l: "ARS", t: "--success" }],
  [{ c: "$", l: "Mercury", t: "--mercury" }, { c: "P", l: "Payoneer", t: "--payoneer" }, { c: "B", l: "Belo", t: "--belo" }, { c: "$", l: "ARS", t: "--success" }],
  [{ c: "$", l: "Mercury", t: "--mercury" }, { c: "GF", l: "GrabrFi", t: "--grabrfi" }, { c: "B", l: "Belo", t: "--belo" }, { c: "$", l: "ARS", t: "--success" }],
  [{ c: "$", l: "Mercury (Wire)", t: "--mercury" }, { c: "S", l: "Santander", t: "--santander" }, { c: "B", l: "Belo", t: "--belo" }, { c: "$", l: "ARS", t: "--success" }],
  [{ c: "$", l: "Mercury", t: "--mercury" }, { c: "GF", l: "GrabrFi", t: "--grabrfi" }, { c: "₮", l: "USDT (Tron/BSC)", t: "--success" }, { c: "BNB", l: "Binance P2P", t: "--belo" }, { c: "$", l: "ARS", t: "--success" }],
];

export default function TransferFlowDiagram() {
  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-4 text-xl font-bold">Flujo de Transferencia</h3>
      {ROUTES.map((nodes, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-3 last:border-0">
          {nodes.map((n, j) => (
            <div key={j} className="flex items-center gap-2">
              {j > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ background: `hsl(var(${n.t}))` }}>{n.c}</span>
                {n.l}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
