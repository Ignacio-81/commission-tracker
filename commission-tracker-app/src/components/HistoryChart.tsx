import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { HistoryPoint } from "../hooks/useCommissionData";
import { fmtNum } from "../lib/format";

const round2 = (v: number | null | undefined) =>
  v == null ? null : Math.round(v * 100) / 100;

interface ChartRow {
  label: string;
  rate: number;
  belo: number | null;
  binance: number | null;
  mep: number | null;
}

const SERIES: { key: keyof ChartRow; name: string; color: string }[] = [
  { key: "rate", name: "Mejor ruta", color: "hsl(173 80% 55%)" },
  { key: "belo", name: "Belo", color: "hsl(45 93% 58%)" },
  { key: "binance", name: "Binance P2P", color: "hsl(38 92% 50%)" },
  { key: "mep", name: "MEP", color: "hsl(217 91% 60%)" },
];

// Re-lee el histórico de localStorage. `tick` fuerza refresco cuando cambian las comisiones.
export default function HistoryChart({ tick }: { tick: number }) {
  const [data, setData] = useState<ChartRow[]>([]);

  useEffect(() => {
    let h: HistoryPoint[] = [];
    try { h = JSON.parse(localStorage.getItem("history.v1") || "[]"); } catch { /* noop */ }
    setData(
      h.map((p) => ({
        label: new Date(p.t).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        rate: round2(p.rate) ?? 0,
        belo: round2(p.belo),
        binance: round2(p.binance),
        mep: round2(p.mep),
      }))
    );
  }, [tick]);

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-4 text-xl font-bold">📈 Histórico — Tasas USD→ARS (Mejor ruta, Belo, Binance P2P, MEP)</h3>
      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Acumulando datos… el histórico se construye con cada actualización.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(215 20% 30% / 0.2)" />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={40} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 11 }} width={60}
              tickFormatter={(v) => fmtNum(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(222 47% 18%)", borderRadius: 8, color: "#e2e8f0" }}
              formatter={(v: number, name: string) => [`${fmtNum(v)} ARS`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
                stroke={s.color} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2.5 text-xs text-muted-foreground">El histórico se acumula en este navegador (localStorage).</p>
    </div>
  );
}
