import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  /** ROI de arbitraje (%) calculado para el monto de referencia */
  roi: number;
  /** Marca de tiempo del último refresh — dispara la evaluación de notificación */
  refreshKey: number;
}

const STORE = "alerts.v1";
type AlertCfg = { threshold: number; notify: boolean };

function load(): AlertCfg {
  try { return { threshold: 1, notify: false, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; }
  catch { return { threshold: 1, notify: false }; }
}

export default function AlertsBanner({ roi, refreshKey }: Props) {
  const [cfg, setCfg] = useState<AlertCfg>(load);
  const lastNotified = useRef<number>(0);

  const save = (next: AlertCfg) => { setCfg(next); localStorage.setItem(STORE, JSON.stringify(next)); };

  const active = roi >= cfg.threshold;

  // Notificación del navegador: solo al cruzar el umbral (no repite en cada refresh)
  useEffect(() => {
    if (!cfg.notify || !active) { if (!active) lastNotified.current = 0; return; }
    if (lastNotified.current) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("CommissionTracker — Oportunidad de puré 📈", {
        body: `El arbitraje MEP rinde ${roi.toFixed(2)}% (umbral ${cfg.threshold}%).`,
      });
      lastNotified.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, active]);

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") await Notification.requestPermission();
    save({ ...cfg, notify: Notification.permission === "granted" });
  };

  return (
    <div className={`rounded-xl border p-5 ${active ? "border-success/50 bg-success/10 glow-success" : "border-border/60 bg-card/50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {active ? <TrendingUp className="h-6 w-6 text-success" /> : <AlertTriangle className="h-6 w-6 text-muted-foreground" />}
          <div>
            <div className="font-bold">
              {active ? `¡Oportunidad de puré! ROI ${roi.toFixed(2)}%` : "Sin oportunidad por ahora"}
            </div>
            <div className="text-sm text-muted-foreground">
              {active
                ? `Supera tu umbral de ${cfg.threshold}%. Buen momento para hacer el ciclo.`
                : `Arbitraje actual: ${roi.toFixed(2)}% · umbral configurado: ${cfg.threshold}%`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Umbral %
            <input
              type="number" step="0.1" value={cfg.threshold}
              onChange={(e) => save({ ...cfg, threshold: parseFloat(e.target.value) || 0 })}
              className="w-20 rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <button
            onClick={() => (cfg.notify ? save({ ...cfg, notify: false }) : askPermission())}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-semibold transition hover:border-primary/60"
          >
            {cfg.notify ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
            {cfg.notify ? "Notificaciones ON" : "Activar avisos"}
          </button>
        </div>
      </div>
    </div>
  );
}
