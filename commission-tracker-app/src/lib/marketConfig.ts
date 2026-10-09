// Config de mercado compartida por la app web (React) y el Worker del widget.
// Sin dependencias de React ni del navegador.
import type { LiveRates } from "./criptoya";

export interface MarketConfig {
  // Tasas en vivo: null = no se pudo traer de la web (no hay valor de respaldo).
  astropayUsdToArs: number | null;
  astropayUsdtToArs: number | null;
  beloUsdtToArs: number | null;
  binanceUsdtToArs: number | null;
  takenosUsdToArs: number | null;
  mercuryAchOut: number;
  mercuryWireOut: number;
  grabrfiAchOutPct: number;
  grabrfiAchOutMin: number;
  grabrfiAchOutMax: number;
  grabrfiUsdToUsdtPct: number;
  grabrfiUsdtWithdrawPct: number;
  grabrfiUsdtWithdrawFixed: number;
  astropayReceiveFee: number;
  beloAchInPct: number;
  beloAchInMin: number;
  payoneerAchIn: number;
  payoneerAchOutFixed: number;
  payoneerAchOutSmall: number;
  payoneerSmallThreshold: number;
}

export type RateKey = "astropayUsdToArs" | "astropayUsdtToArs" | "beloUsdtToArs" | "binanceUsdtToArs" | "takenosUsdToArs";
export type FeeKey = Exclude<keyof MarketConfig, RateKey>;
export const RATE_KEYS: RateKey[] = ["astropayUsdToArs", "astropayUsdtToArs", "beloUsdtToArs", "binanceUsdtToArs", "takenosUsdToArs"];

export const DEFAULTS: MarketConfig = {
  // Las tasas NO tienen valor por defecto: se llenan en cada refresh desde la web.
  // Takenos no publica una API/tasa propia consultable por CORS. Se usa el totalBid de
  // TiendaCrypto (USDT/ARS vía CriptoYa), que calzó exacto con la tasa real mostrada
  // in-app por Takenos en mediciones separadas (sep-2026) — evidencia de que es su
  // proveedor de liquidez. Fallback: dólar cripto (dolarapi.com), luego MEP.
  astropayUsdToArs: null,
  astropayUsdtToArs: null,
  beloUsdtToArs: null,
  binanceUsdtToArs: null,
  takenosUsdToArs: null,
  mercuryAchOut: 0,
  mercuryWireOut: 15,
  grabrfiAchOutPct: 0.3,
  grabrfiAchOutMin: 1,
  grabrfiAchOutMax: 5,
  grabrfiUsdToUsdtPct: 0.8,
  grabrfiUsdtWithdrawPct: 1.1,
  grabrfiUsdtWithdrawFixed: 1,
  astropayReceiveFee: 0,
  // MEDIDO 5-ago-2026 sobre una operación real: entraron 1300 USDC, descontó 6,50 → 0,500%.
  // El tarifario público de Belo dice 0,3%; el valor medido tiene precedencia.
  beloAchInPct: 0.5,
  beloAchInMin: 0.5,
  payoneerAchIn: 1,
  payoneerAchOutFixed: 1.5,
  payoneerAchOutSmall: 4,
  payoneerSmallThreshold: 400,
};

export function withoutRates(cfg: MarketConfig): MarketConfig {
  const next = { ...cfg };
  for (const k of RATE_KEYS) next[k] = null;
  return next;
}
// Vuelca las tasas en vivo al config; los campos editados a mano se respetan.
// Si una fuente no respondió queda en null (error), nunca un valor viejo.
export function applyLiveRates(cfg: MarketConfig, rates: LiveRates | null, manual: string[]): MarketConfig {
  const live: Record<RateKey, number | null> = {
    astropayUsdtToArs: rates?.astropay ?? null,
    astropayUsdToArs: rates?.astropay ?? null,
    beloUsdtToArs: rates?.belo ?? null,
    binanceUsdtToArs: rates?.binance ?? null,
    takenosUsdToArs: rates?.takenos ?? null,
  };
  const next = { ...cfg };
  for (const k of RATE_KEYS) if (!manual.includes(k)) next[k] = live[k];
  return next;
}

const MISSING_LABELS: [RateKey | "mep", string][] = [
  ["astropayUsdtToArs", "AstroPay"], ["beloUsdtToArs", "Belo"], ["binanceUsdtToArs", "Binance P2P"],
  ["takenosUsdToArs", "Takenos"], ["mep", "Dólar MEP (Santander)"],
];
export function missingRates(cfg: MarketConfig, rates: LiveRates | null): string[] {
  return MISSING_LABELS
    .filter(([k]) => (k === "mep" ? rates?.mep == null : cfg[k] == null))
    .map(([, label]) => label);
}
