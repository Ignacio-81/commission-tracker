import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { chartHistory, HISTORY_DAYS, type ChartRow } from "../lib/history";
import { fmtNum } from "../lib/format";

const SERIES: { key: keyof ChartRow; name: string; color: string }[] = [
  { key: "belo", name: "Belo", color: "hsl(45 93% 58%)" },
  { key: "binance", name: "Binance P2P", color: "hsl(38 92% 50%)" },
  { key: "mep", name: "MEP", color: "hsl(217 91% 60%)" },
  { key: "takenos", name: "Takenos", color: "hsl(150 65% 45%)" },
];

const DAY = 24 * 60 * 60 * 1000;
const TZ = "America/Argentina/Buenos_Aires";
const fmtDay = (t: number) => new Date(t).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: TZ });
const fmtDayTime = (t: number) =>
  new Date(t).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtBucket = (ms: number) =>
  ms >= DAY ? "1 día" : ms >= 60 * 60 * 1000 ? `${ms / 3600000} h` : `${ms / 60000} min`;

// Re-lee el histórico de localStorage. `tick` fuerza refresco cuando cambian las comisiones.
export default function HistoryChart({ tick }: { tick: number }) {
  const [data, setData] = useState<ChartRow[]>([]);
  const [bucketMs, setBucketMs] = useState(0);

  useEffect(() => {
    const { rows, bucketMs } = chartHistory();
    setData(rows);
    setBucketMs(bucketMs);
  }, [tick]);

  const first = data[0]?.t;
  const last = data[data.length - 1]?.t;
  const spanDays = first != null && last != null ? Math.max(1, Math.round((last - first) / DAY)) : 0;
  const multiDay = spanDays >= 2;

  return (
    <div className="glass-card rounded-xl p-6">
      <h3 className="mb-1 text-xl font-bold">📈 Histórico — Tasas USD→ARS (Belo, Binance P2P, MEP, Takenos)</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Últimos {HISTORY_DAYS} días
        {first != null && <> · datos desde {fmtDay(first)} ({spanDays} {spanDays === 1 ? "día" : "días"})</>}
        {bucketMs > 0 && data.length > 1 && <> · promedio cada {fmtBucket(bucketMs)}</>}
      </p>
      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Acumulando datos… el histórico se construye con cada actualización.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(215 20% 30% / 0.2)" />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tick={{ fill: "#64748b", fontSize: 11 }} minTickGap={40}
              tickFormatter={(t: number) => (multiDay ? fmtDay(t) : fmtDayTime(t))} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 11 }} width={60}
              tickFormatter={(v) => fmtNum(v)} />
            <Tooltip
              contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(222 47% 18%)", borderRadius: 8, color: "#e2e8f0" }}
              labelFormatter={(t: number) => (bucketMs >= DAY ? fmtDay(t) : fmtDayTime(t))}
              formatter={(v: number, name: string) => [`${fmtNum(v)} ARS`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
                stroke={s.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-2.5 text-xs text-muted-foreground">
        El histórico se acumula en este navegador (localStorage) mientras la app está abierta; se conservan {HISTORY_DAYS} días.
      </p>
    </div>
  );
}
