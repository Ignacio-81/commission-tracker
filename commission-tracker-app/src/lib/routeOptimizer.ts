// ─────────────────────────────────────────────────────────────────────────────
// Optimizador de rutas (v2)
//
// Modela el flujo USD→ARS como un GRAFO DIRIGIDO y encuentra, por fuerza bruta
// sobre todos los caminos simples, la combinación de billeteras que deja el
// MAYOR monto final en ARS para un monto de entrada dado.
//
// Restricción de negocio (jun-2026): el origen es siempre Mercury y la única
// salida desde Mercury es vía GrabrFi o Payoneer. Después, el camino es libre.
//
// La aritmética de cada arista replica EXACTAMENTE la de useCommissionData.ts
// (rutas auditadas R1/R2/R3/R5), de modo que agregar una billetera nueva es
// solo agregar un nodo + arista: los caminos nuevos aparecen solos.
// ─────────────────────────────────────────────────────────────────────────────

import type { MarketConfig } from "../hooks/useCommissionData";

const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

export type Unit = "USD" | "USDT" | "ARS";

export interface RouteStep {
  label: string;      // descripción de la operación
  fee: string;        // comisión aplicada, legible
  amountOut: number;  // monto resultante tras la operación
  unit: Unit;         // unidad del monto resultante
}

export interface RouteResult {
  id: string;            // identificador estable del camino
  name: string;          // "Mercury → GrabrFi → Belo → ARS (Belo/MEP)"
  finalARS: number;      // monto final en pesos
  effectiveRate: number; // ARS por cada USD de entrada
  steps: RouteStep[];    // desglose paso a paso
}

// ── Nodos del grafo ──────────────────────────────────────────────────────────
interface NodeDef { id: string; label: string; unit: Unit; terminal?: boolean; }

const NODES: Record<string, NodeDef> = {
  mercury:       { id: "mercury",       label: "Mercury",            unit: "USD" },
  grabrfi:       { id: "grabrfi",       label: "GrabrFi",            unit: "USD" },
  payoneer:      { id: "payoneer",      label: "Payoneer",           unit: "USD" },
  belo:          { id: "belo",          label: "Belo",               unit: "USD" },
  grabrfi_usdt:  { id: "grabrfi_usdt",  label: "USDT (GrabrFi)",     unit: "USDT" },
  ars_belo:      { id: "ars_belo",      label: "ARS (Belo/MEP)",     unit: "ARS", terminal: true },
  ars_astropay:  { id: "ars_astropay",  label: "ARS (AstroPay)",     unit: "ARS", terminal: true },
  ars_binance:   { id: "ars_binance",   label: "ARS (Binance P2P)",  unit: "ARS", terminal: true },
};

// ── Aristas del grafo ────────────────────────────────────────────────────────
// apply() recibe el monto entrante y la config de mercado, y devuelve el monto
// saliente + los sub-pasos con su comisión legible.
interface EdgeDef {
  from: string;
  to: string;
  apply: (amount: number, cfg: MarketConfig) => { amount: number; steps: RouteStep[] };
}

const pct = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
const usd = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

const EDGES: EdgeDef[] = [
  // Mercury → GrabrFi (ACH out de Mercury, normalmente $0)
  {
    from: "mercury", to: "grabrfi",
    apply: (amt, c) => {
      const out = amt - c.mercuryAchOut;
      return { amount: out, steps: [
        { label: "Mercury → GrabrFi (ACH)", fee: usd(c.mercuryAchOut), amountOut: out, unit: "USD" },
      ] };
    },
  },

  // Mercury → Payoneer (ACH out de Mercury + recepción Payoneer %)
  {
    from: "mercury", to: "payoneer",
    apply: (amt, c) => {
      const afterMercury = amt - c.mercuryAchOut;
      const recFee = (afterMercury * c.payoneerAchIn) / 100;
      const out = afterMercury - recFee;
      return { amount: out, steps: [
        { label: "Mercury → Payoneer (ACH)", fee: usd(c.mercuryAchOut), amountOut: afterMercury, unit: "USD" },
        { label: "Recepción Payoneer", fee: pct(c.payoneerAchIn), amountOut: out, unit: "USD" },
      ] };
    },
  },

  // GrabrFi → Belo (ACH out GrabrFi 0,3% mín/máx + recepción Belo 0,3% mín)
  {
    from: "grabrfi", to: "belo",
    apply: (amt, c) => {
      const grabrFee = clamp((amt * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
      const afterGrabr = amt - grabrFee;
      const beloFee = Math.max((afterGrabr * c.beloAchInPct) / 100, c.beloAchInMin);
      const out = afterGrabr - beloFee;
      return { amount: out, steps: [
        { label: "GrabrFi → Belo (ACH out)", fee: `${pct(c.grabrfiAchOutPct)} (mín ${usd(c.grabrfiAchOutMin)}, máx ${usd(c.grabrfiAchOutMax)})`, amountOut: afterGrabr, unit: "USD" },
        { label: "Recepción Belo", fee: `${pct(c.beloAchInPct)} (mín ${usd(c.beloAchInMin)})`, amountOut: out, unit: "USD" },
      ] };
    },
  },

  // Payoneer → Belo (retiro Payoneer USD fijo según umbral + recepción Belo)
  {
    from: "payoneer", to: "belo",
    apply: (amt, c) => {
      const pOut = amt < c.payoneerSmallThreshold ? c.payoneerAchOutSmall : c.payoneerAchOutFixed;
      const afterPayoneer = amt - pOut;
      const beloFee = Math.max((afterPayoneer * c.beloAchInPct) / 100, c.beloAchInMin);
      const out = afterPayoneer - beloFee;
      return { amount: out, steps: [
        { label: "Retiro Payoneer → Belo", fee: `${usd(pOut)} fijo`, amountOut: afterPayoneer, unit: "USD" },
        { label: "Recepción Belo", fee: `${pct(c.beloAchInPct)} (mín ${usd(c.beloAchInMin)})`, amountOut: out, unit: "USD" },
      ] };
    },
  },

  // GrabrFi → USDT (ACH out GrabrFi + conversión USD→USDT)
  {
    from: "grabrfi", to: "grabrfi_usdt",
    apply: (amt, c) => {
      const grabrFee = clamp((amt * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
      const afterGrabr = amt - grabrFee;
      const convFee = (afterGrabr * c.grabrfiUsdToUsdtPct) / 100;
      const out = afterGrabr - convFee;
      return { amount: out, steps: [
        { label: "GrabrFi ACH out", fee: `${pct(c.grabrfiAchOutPct)} (mín ${usd(c.grabrfiAchOutMin)}, máx ${usd(c.grabrfiAchOutMax)})`, amountOut: afterGrabr, unit: "USD" },
        { label: "Conversión USD → USDT", fee: pct(c.grabrfiUsdToUsdtPct), amountOut: out, unit: "USDT" },
      ] };
    },
  },

  // USDT → ARS vía AstroPay (retiro USDT 1,1%+$1 + recepción AstroPay + venta a tasa AstroPay)
  {
    from: "grabrfi_usdt", to: "ars_astropay",
    apply: (amt, c) => {
      const wd = (amt * c.grabrfiUsdtWithdrawPct) / 100 + c.grabrfiUsdtWithdrawFixed;
      const afterWd = amt - wd;
      const afterRecv = afterWd - c.astropayReceiveFee;
      const out = afterRecv * c.astropayUsdtToArs;
      return { amount: out, steps: [
        { label: "Retiro USDT (red)", fee: `${pct(c.grabrfiUsdtWithdrawPct)} + ${usd(c.grabrfiUsdtWithdrawFixed)}`, amountOut: afterWd, unit: "USDT" },
        { label: "Recepción AstroPay", fee: usd(c.astropayReceiveFee), amountOut: afterRecv, unit: "USDT" },
        { label: "Venta USDT → ARS (AstroPay)", fee: `× ${c.astropayUsdtToArs.toLocaleString("es-AR")}`, amountOut: out, unit: "ARS" },
      ] };
    },
  },

  // USDT → ARS vía Binance P2P (retiro USDT 1,1%+$1 + venta P2P a tasa Binance)
  {
    from: "grabrfi_usdt", to: "ars_binance",
    apply: (amt, c) => {
      const wd = (amt * c.grabrfiUsdtWithdrawPct) / 100 + c.grabrfiUsdtWithdrawFixed;
      const afterWd = amt - wd;
      const out = afterWd * c.binanceUsdtToArs;
      return { amount: out, steps: [
        { label: "Retiro USDT (red)", fee: `${pct(c.grabrfiUsdtWithdrawPct)} + ${usd(c.grabrfiUsdtWithdrawFixed)}`, amountOut: afterWd, unit: "USDT" },
        { label: "Venta USDT → ARS (Binance P2P)", fee: `× ${c.binanceUsdtToArs.toLocaleString("es-AR")}`, amountOut: out, unit: "ARS" },
      ] };
    },
  },

  // Belo USD → ARS (venta a tasa Belo/MEP)
  {
    from: "belo", to: "ars_belo",
    apply: (amt, c) => {
      const out = amt * c.beloUsdtToArs;
      return { amount: out, steps: [
        { label: "Venta USD → ARS (Belo/MEP)", fee: `× ${c.beloUsdtToArs.toLocaleString("es-AR")}`, amountOut: out, unit: "ARS" },
      ] };
    },
  },
];

const START = "mercury";

// Enumera todos los caminos simples desde Mercury hasta cualquier nodo terminal (ARS).
function enumeratePaths(): EdgeDef[][] {
  const paths: EdgeDef[][] = [];
  const dfs = (nodeId: string, trail: EdgeDef[], visited: Set<string>) => {
    if (NODES[nodeId]?.terminal) { paths.push(trail); return; }
    for (const e of EDGES) {
      if (e.from === nodeId && !visited.has(e.to)) {
        dfs(e.to, [...trail, e], new Set(visited).add(e.to));
      }
    }
  };
  dfs(START, [], new Set([START]));
  return paths;
}

/**
 * Calcula todas las rutas posibles para `amountUSD` y las devuelve ordenadas
 * de mayor a menor monto final en ARS. results[0] es la mejor combinación.
 */
export function optimizeRoutes(amountUSD: number, cfg: MarketConfig): RouteResult[] {
  const results = enumeratePaths().map((edges): RouteResult => {
    let amount = amountUSD;
    const steps: RouteStep[] = [];
    const nodeIds = [START];
    for (const e of edges) {
      const r = e.apply(amount, cfg);
      amount = r.amount;
      steps.push(...r.steps);
      nodeIds.push(e.to);
    }
    return {
      id: nodeIds.join(">"),
      name: nodeIds.map((id) => NODES[id].label).join(" → "),
      finalARS: amount,
      effectiveRate: amountUSD > 0 ? amount / amountUSD : 0,
      steps,
    };
  });
  return results.sort((a, b) => b.finalARS - a.finalARS);
}
