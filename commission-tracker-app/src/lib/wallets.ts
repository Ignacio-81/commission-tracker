// Selección de billeteras/bancos de destino que entran en el cálculo.
// Lo que no está seleccionado se excluye del ranking y se oculta de la UI (rutas, tarjetas de
// tasa, series del histórico, comisiones del panel, puré). Se guarda en localStorage.
// Sin dependencias de React: lo usan la web y el optimizador v2.
import type { FeeKey } from "./marketConfig";

export type SelectableWallet = "astropay" | "belo" | "takenos" | "santander" | "binance";
export type EnabledWallets = Record<SelectableWallet, boolean>;

export const SELECTABLE_WALLETS: { id: SelectableWallet; label: string; tone: string }[] = [
  { id: "astropay", label: "AstroPay", tone: "var(--astropay)" },
  { id: "belo", label: "Belo", tone: "var(--belo)" },
  { id: "takenos", label: "Takenos", tone: "var(--takenos)" },
  { id: "santander", label: "Santander", tone: "var(--santander)" },
  { id: "binance", label: "Binance P2P", tone: "38 92% 50%" },
];

export const ALL_ENABLED: EnabledWallets = {
  astropay: true, belo: true, takenos: true, santander: true, binance: true,
};

const STORAGE_KEY = "enabledWallets.v1";

export function loadEnabledWallets(): EnabledWallets {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const next = { ...ALL_ENABLED };
    for (const w of SELECTABLE_WALLETS) if (typeof saved[w.id] === "boolean") next[w.id] = saved[w.id];
    return next;
  } catch { return { ...ALL_ENABLED }; }
}

export function saveEnabledWallets(en: EnabledWallets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(en)); } catch { /* noop */ }
}

/** Billetera de destino de cada ruta fija (id de TransferPath). R2 y R3 liquidan en Belo. */
export const ROUTE_WALLET: Record<string, SelectableWallet> = {
  astropay: "astropay", payoneer: "belo", grabrfi: "belo",
  santander: "santander", binance: "binance", takenos: "takenos",
};

/**
 * ¿La comisión del panel ⚙️ Mercado participa en alguna ruta visible?
 * Intermediarios: Payoneer y el ACH de GrabrFi solo sirven para llegar a Belo; el envío USDT de
 * GrabrFi solo para AstroPay / Binance P2P; el wire de Mercury solo para Santander.
 */
export function feeFieldVisible(key: FeeKey, en: EnabledWallets): boolean {
  switch (key) {
    case "mercuryAchOut": return en.astropay || en.belo || en.binance || en.takenos;
    case "mercuryWireOut": return en.santander;
    case "grabrfiAchOutPct": case "grabrfiAchOutMin": case "grabrfiAchOutMax": return en.belo;
    case "grabrfiUsdtWithdrawPct": case "grabrfiUsdtWithdrawFixed": return en.astropay || en.binance;
    case "astropayReceiveFee": return en.astropay;
    case "beloAchInFixed": return en.belo;
    case "payoneerAchIn": case "payoneerAchOutFixed": case "payoneerAchOutSmall": case "payoneerSmallThreshold":
      return en.belo;
    default: return true;
  }
}
