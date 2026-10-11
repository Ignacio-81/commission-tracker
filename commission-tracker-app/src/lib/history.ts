// Histórico de tasas USD→ARS en localStorage.
//
// Retención por ANTIGÜEDAD (últimos HISTORY_DAYS días), no por cantidad de puntos: antes el tope
// era 5000 puntos, que a un refresh cada 5 min alcanzaba para ~17 días. Con 60 días el peor caso
// son ~17.300 puntos (~1,5 MB), dentro del cupo de localStorage. Para el gráfico los puntos se
// agregan en intervalos (promedio por serie) así 2 meses no son miles de vértices.

export const HISTORY_KEY = "history.v1";
export const HISTORY_DAYS = 60;
export const HISTORY_WINDOW_MS = HISTORY_DAYS * 24 * 60 * 60 * 1000;

/** El auto-refresh es cada 5 min: dos puntos más cercanos que esto se consideran el mismo. */
const MIN_SPACING_MS = 4 * 60 * 1000;
/** Red de seguridad por si algo dispara snapshots en ráfaga. */
const HARD_MAX = 20000;

export const SERIES_KEYS = ["belo", "binance", "mep", "takenos"] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];

export interface HistoryPoint {
  t: number;
  belo?: number | null;
  binance?: number | null;
  mep?: number | null;
  takenos?: number | null;
}

export function readHistory(): HistoryPoint[] {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(h) ? h.filter((p) => p && typeof p.t === "number") : [];
  } catch {
    return [];
  }
}

/** Agrega un punto, descarta lo que tenga más de HISTORY_DAYS días y persiste. */
export function appendHistory(point: HistoryPoint): void {
  const cutoff = point.t - HISTORY_WINDOW_MS;
  const h = readHistory().filter((p) => p.t >= cutoff);
  const last = h[h.length - 1];
  // Refresh manual o al volver a la pestaña justo después del automático: pisa el último punto.
  if (last && point.t - last.t < MIN_SPACING_MS) h[h.length - 1] = point;
  else h.push(point);
  if (h.length > HARD_MAX) h.splice(0, h.length - HARD_MAX);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    // Cupo lleno: se resigna la mitad más vieja antes que dejar de registrar.
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(Math.floor(h.length / 2)))); } catch { /* noop */ }
  }
}

export interface ChartRow {
  t: number;
  belo: number | null;
  binance: number | null;
  mep: number | null;
  takenos: number | null;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const BUCKETS = [5 * MIN, 15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, 24 * HOUR];
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Últimos HISTORY_DAYS días, promediados en intervalos para no superar ~maxPoints puntos.
 * Devuelve también el intervalo usado (ms) para formatear etiquetas.
 */
export function chartHistory(now = Date.now(), maxPoints = 400): { rows: ChartRow[]; bucketMs: number } {
  const pts = readHistory().filter((p) => p.t >= now - HISTORY_WINDOW_MS && p.t <= now);
  if (!pts.length) return { rows: [], bucketMs: BUCKETS[0] };

  const span = pts[pts.length - 1].t - pts[0].t;
  const bucketMs = BUCKETS.find((b) => span / b <= maxPoints) ?? BUCKETS[BUCKETS.length - 1];

  // Buckets alineados a la hora local de Argentina (UTC-3 fijo) para que los diarios corten a medianoche.
  const OFFSET = -3 * HOUR;
  const acc = new Map<number, { sum: Record<SeriesKey, number>; n: Record<SeriesKey, number> }>();
  for (const p of pts) {
    const key = Math.floor((p.t + OFFSET) / bucketMs) * bucketMs - OFFSET;
    let b = acc.get(key);
    if (!b) {
      b = { sum: { belo: 0, binance: 0, mep: 0, takenos: 0 }, n: { belo: 0, binance: 0, mep: 0, takenos: 0 } };
      acc.set(key, b);
    }
    for (const k of SERIES_KEYS) {
      const v = p[k];
      if (typeof v === "number" && Number.isFinite(v)) { b.sum[k] += v; b.n[k]++; }
    }
  }

  const rows: ChartRow[] = [];
  for (const [t, b] of [...acc.entries()].sort((a, z) => a[0] - z[0])) {
    const row: ChartRow = { t, belo: null, binance: null, mep: null, takenos: null };
    for (const k of SERIES_KEYS) row[k] = b.n[k] ? round2(b.sum[k] / b.n[k]) : null;
    // Puntos viejos que solo tenían la "mejor ruta" (ya no se grafica) quedarían vacíos.
    if (SERIES_KEYS.some((k) => row[k] != null)) rows.push(row);
  }
  return { rows, bucketMs };
}
