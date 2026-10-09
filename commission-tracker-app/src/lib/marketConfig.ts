// Config de mercado compartida por la app web (React) y el generador del widget (widget-data/).
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
  grabrfiUsdtWithdrawPct: number;
  grabrfiUsdtWithdrawFixed: number;
  astropayReceiveFee: number;
  beloAchInFixed: number;
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
  // GrabrFi — tarifario vigente desde el 3-sep-2026 (help.grabrfi.com/en/content/full-schedule-of-fees):
  // ACH saliente 0,5% (mín $1, máx $10); USDT saliente 0,5% + $1. El saldo USD se convierte a
  // USDT automáticamente al enviar: NO hay una comisión de conversión aparte.
  grabrfiAchOutPct: 0.5,
  grabrfiAchOutMin: 1,
  grabrfiAchOutMax: 10,
  grabrfiUsdtWithdrawPct: 0.5,
  grabrfiUsdtWithdrawFixed: 1,
  astropayReceiveFee: 0,
  // Belo — ACH/FedNow entrante: $3 fijos por transacción según la ayuda oficial (oct-2026).
  // Antes se medía 0,5% (5-ago-2026: 6,50 sobre 1300 USDC); Belo cambió el tarifario.
  // Wire entrante: $20. Se acredita solo lo que supera la comisión.
  beloAchInFixed: 3,
  payoneerAchIn: 1,
  payoneerAchOutFixed: 1.5,
  payoneerAchOutSmall: 4,
  payoneerSmallThreshold: 400,
};

/** Belo: máximo por transferencia de terceros (ayuda oficial). Montos mayores se revierten al remitente. */
export const BELO_MAX_PER_TX_USD = 4000;

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
