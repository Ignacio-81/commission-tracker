#!/usr/bin/env node
/**
 * verify-rates.mjs — chequeo determinista de tasas, comisiones y rutas.
 *
 * Uso:
 *   node scripts/verify-rates.mjs           # tasas en vivo desde CriptoYa
 *   node scripts/verify-rates.mjs --offline # usa las tasas de referencia (sin red)
 *   node scripts/verify-rates.mjs --json    # salida JSON para diffear entre corridas
 *   node scripts/verify-rates.mjs --strict  # los avisos de plausibilidad también fallan
 *
 * Qué hace:
 *   1. Verifica que cada endpoint de CriptoYa responda y que el campo que parsea la app exista.
 *   2. Verifica que las comisiones hardcodeadas en useCommissionData.ts y CommissionTracker.html
 *      coincidan con los valores esperados de esta tabla (fuente: auditoría oficial).
 *   3. Corre las 5 rutas en varios montos y chequea invariantes (sin NaN, sin negativos, etc).
 *   4. Chequea que las tasas sean PLAUSIBLES ENTRE SÍ (ver checkPlausibility).
 *   5. Sale con código 1 si hay algún diff, para que una tarea programada lo detecte.
 *      Con --strict, los avisos de plausibilidad también hacen fallar la corrida.
 *
 * Cuando cambies una comisión a propósito, actualizá EXPECTED_FEES acá también.
 */

const args = process.argv.slice(2);
const OFFLINE = args.includes("--offline");
const AS_JSON = args.includes("--json");
const STRICT = args.includes("--strict");

// Umbrales de plausibilidad. Ver checkPlausibility().
const MEP_OUTLIER_PCT = 2.5;   // desvío máx. del MEP vs el cluster de dólar cripto/CCL
const ROI_NOISE_PCT = 1.5;     // por debajo de este margen, el ROI del puré es ruido

/* ------------------------------------------------------------------ */
/* 1. Comisiones esperadas — la fuente de verdad de este chequeo        */
/* ------------------------------------------------------------------ */

const EXPECTED_FEES = {
  mercuryAchOut: 0,
  mercuryWireOut: 15,
  grabrfiAchOutPct: 0.3,
  grabrfiAchOutMin: 1,
  grabrfiAchOutMax: 5,
  grabrfiUsdToUsdtPct: 0.8,
  grabrfiUsdtWithdrawPct: 1.1,
  grabrfiUsdtWithdrawFixed: 1,
  astropayReceiveFee: 0,
  beloAchInPct: 0.5, // medido 5-ago-2026 (6,50 sobre 1300); el tarifario público dice 0,3%
  beloAchInMin: 0.5,
  beloUsdToUsdtSpread: 4,
  payoneerAchIn: 1,
  payoneerAchOutFixed: 1.5,
  payoneerAchOutSmall: 4,
  payoneerSmallThreshold: 400,
};

// Estado de verificación de cada fee.
//   official  = contrastado contra tarifario público
//   measured  = medido sobre una operación real (tiene precedencia sobre lo publicado)
//   estimated = sin fuente, valor supuesto
const FEE_STATUS = {
  mercuryAchOut: "official",
  mercuryWireOut: "official",
  grabrfiAchOutPct: "official",
  grabrfiAchOutMin: "official",
  grabrfiAchOutMax: "official",
  grabrfiUsdToUsdtPct: "estimated",
  grabrfiUsdtWithdrawPct: "official",
  grabrfiUsdtWithdrawFixed: "official",
  astropayReceiveFee: "estimated",
  beloAchInPct: "measured",
  beloAchInMin: "official",
  beloUsdToUsdtSpread: "estimated",
  payoneerAchIn: "official",
  payoneerAchOutFixed: "official",
  payoneerAchOutSmall: "official",
  payoneerSmallThreshold: "official",
};

// Tasas de referencia para --offline. Snapshot de la corrida en vivo del 7-ago-2026.
// Ojo: este set tiene el MEP desalineado del resto (ver checkPlausibility), así que
// `--offline` dispara los avisos de plausibilidad a propósito. Es útil como caso de prueba.
const REFERENCE_RATES = {
  belo: 1565.59,
  astropay: 1550.17,
  binance: 1565.52,
  mep: 1525.04,
  ccl: 1584.27,
};

const ENDPOINTS = [
  { key: "dolar", url: "https://criptoya.com/api/dolar", pick: (j) => j?.mep?.al30?.["24hs"]?.price, field: 'mep.al30["24hs"].price' },
  { key: "astropay", url: "https://criptoya.com/api/astropay/usdt/ars/1", pick: (j) => j?.totalBid ?? j?.bid, field: "totalBid" },
  { key: "belo", url: "https://criptoya.com/api/belo/usdc/ars/1", pick: (j) => j?.totalBid ?? j?.bid, field: "totalBid" },
  { key: "binance", url: "https://criptoya.com/api/binancep2p/usdt/ars/1", pick: (j) => j?.totalBid ?? j?.bid, field: "totalBid" },
];

/* ------------------------------------------------------------------ */
/* 2. Lógica de rutas — espejo de useCommissionData.ts                  */
/* ------------------------------------------------------------------ */

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

function computeRoutes(amount, c, rates) {
  const a = amount - c.mercuryAchOut;
  const b = a - clamp((a * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
  const cc = b - (b * c.grabrfiUsdToUsdtPct) / 100;
  const wd = (cc * c.grabrfiUsdtWithdrawPct) / 100 + c.grabrfiUsdtWithdrawFixed;
  const d = cc - wd - c.astropayReceiveFee;

  const R1 = d * rates.astropay;
  const R5 = (cc - wd) * rates.binance;

  let p = amount - c.mercuryAchOut;
  p -= (p * c.payoneerAchIn) / 100;
  p -= p < c.payoneerSmallThreshold ? c.payoneerAchOutSmall : c.payoneerAchOutFixed;
  p -= Math.max((p * c.beloAchInPct) / 100, c.beloAchInMin);
  const R2 = p * rates.belo;

  let g = amount - c.mercuryAchOut;
  g -= clamp((g * c.grabrfiAchOutPct) / 100, c.grabrfiAchOutMin, c.grabrfiAchOutMax);
  g -= Math.max((g * c.beloAchInPct) / 100, c.beloAchInMin);
  const R3 = g * rates.belo;

  let s = amount - c.mercuryWireOut;
  s -= (s * c.beloUsdToUsdtSpread) / 100;
  const R4 = s * rates.belo;

  return { R1, R2, R3, R4, R5 };
}

/* ------------------------------------------------------------------ */
/* 3. Chequeo de que el código fuente no se desvió de EXPECTED_FEES     */
/* ------------------------------------------------------------------ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function extractDefaults(text) {
  // Toma el bloque DEFAULTS = { ... } y parsea pares clave: número.
  const m = text.match(/DEFAULTS[^{]*\{([\s\S]*?)\n\}/);
  if (!m) return null;
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*(-?[\d.]+)/g)) out[k] = Number(v);
  return out;
}

function checkSource(relPath, label, issues) {
  let text;
  try {
    text = readFileSync(join(ROOT, relPath), "utf8");
  } catch {
    issues.push({ kind: "source", severity: "error", msg: `${label}: no se pudo leer ${relPath}` });
    return;
  }
  const found = extractDefaults(text);
  if (!found) {
    issues.push({ kind: "source", severity: "error", msg: `${label}: no encontré el bloque DEFAULTS` });
    return;
  }
  for (const [k, expected] of Object.entries(EXPECTED_FEES)) {
    if (!(k in found)) {
      issues.push({ kind: "fee", severity: "error", msg: `${label}: falta la clave "${k}"` });
    } else if (found[k] !== expected) {
      issues.push({
        kind: "fee",
        severity: "error",
        msg: `${label}: ${k} = ${found[k]}, esperado ${expected} (${FEE_STATUS[k]})`,
      });
    }
  }
  // Ambas versiones deben conocer la ruta R5.
  if (!("binanceUsdtToArs" in found)) {
    issues.push({ kind: "drift", severity: "error", msg: `${label}: falta binanceUsdtToArs — ¿la ruta R5 está implementada?` });
  }
}

/* ------------------------------------------------------------------ */
/* 4. Main                                                              */
/* ------------------------------------------------------------------ */

/**
 * Devuelve { rates, sources } donde sources[k] es "live" o "fallback".
 *
 * Distinguirlos importa: si un endpoint falla, el script cae a REFERENCE_RATES, que es un
 * snapshot con valores plausibles. Sin marcarlo, la salida es indistinguible de una corrida
 * real y alguien podría operar sobre tasas viejas. Fuera de --offline, un fetch fallido es
 * un ERROR: el chequeo no pudo hacer su trabajo.
 */
async function fetchRates(issues) {
  const rates = { ...REFERENCE_RATES };
  const sources = Object.fromEntries(Object.keys(rates).map((k) => [k, "fallback"]));
  if (OFFLINE) {
    issues.push({ kind: "net", severity: "warn", msg: "modo --offline: usando tasas de referencia, no se verificaron los endpoints" });
    return { rates, sources };
  }
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const val = ep.pick(json);
      if (typeof val !== "number" || !isFinite(val) || val <= 0) {
        issues.push({ kind: "net", severity: "error", msg: `${ep.key}: el campo ${ep.field} no es un número válido (${JSON.stringify(val)}) — ¿cambió el esquema de la API?` });
        continue;
      }
      if (ep.key === "dolar") {
        rates.mep = val;
        sources.mep = "live";
        const cclVal = json?.ccl?.al30?.["24hs"]?.price;
        if (typeof cclVal === "number" && isFinite(cclVal) && cclVal > 0) {
          rates.ccl = cclVal;
          sources.ccl = "live";
        }
      } else {
        rates[ep.key] = val;
        sources[ep.key] = "live";
      }
    } catch (e) {
      issues.push({
        kind: "net",
        severity: "error",
        msg: `${ep.key}: ${e.message} — NO se pudo verificar en vivo, se muestra la tasa de referencia (snapshot, no actual)`,
      });
    }
  }
  return { rates, sources };
}

function checkRoutes(rates, issues) {
  const amounts = [200, 400, 1000, 5000, 20000];
  const table = [];
  for (const amt of amounts) {
    const r = computeRoutes(amt, EXPECTED_FEES, rates);
    for (const [name, v] of Object.entries(r)) {
      if (!isFinite(v)) issues.push({ kind: "calc", severity: "error", msg: `${name} en USD ${amt} dio ${v}` });
      if (v <= 0) issues.push({ kind: "calc", severity: "error", msg: `${name} en USD ${amt} dio un resultado no positivo (${v})` });
      if (v / amt > rates.belo * 1.05) {
        issues.push({ kind: "calc", severity: "error", msg: `${name} en USD ${amt} rinde ${(v / amt).toFixed(2)} ARS/USD, más que la mejor tasa disponible — hay una comisión con signo invertido` });
      }
    }
    const best = Object.entries(r).sort((x, y) => y[1] - x[1])[0];
    table.push({
      amount: amt,
      perUsd: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +(v / amt).toFixed(2)])),
      best: best[0],
      arbitrageRoiPct: +((best[1] / rates.mep / amt - 1) * 100).toFixed(2),
    });
  }
  return table;
}

/**
 * Chequeo de plausibilidad entre tasas.
 *
 * Motivación (ago-2026): una corrida en vivo dio MEP 1525,04 mientras Belo, Binance y CCL
 * estaban en 1565–1584. El dólar cripto sigue de cerca al CCL porque es el mismo arbitraje,
 * así que un MEP 2,7% por debajo de todo el resto es sospechoso. Y como el ROI del puré se
 * calcula `mejor_ruta / MEP`, un MEP subvaluado infla el ROI: con el breakeven a solo 2% del
 * valor observado, la diferencia entre "oportunidad" y "artefacto" es ese único número.
 *
 * El chequeo de esquema y comisiones no ve nada de esto: los valores son numéricos, positivos
 * y con el campo correcto. Por eso hace falta un chequeo aparte de coherencia entre tasas.
 */
function checkPlausibility(rates, table, issues) {
  const median = (xs) => {
    const s = [...xs].filter((x) => typeof x === "number" && isFinite(x) && x > 0).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // El "mercado" de referencia: dólar cripto + CCL. Excluye al MEP a propósito.
  const ref = median([rates.belo, rates.binance, rates.ccl]);
  if (!ref || !rates.mep) {
    issues.push({ kind: "plausibility", severity: "warn", msg: "faltan tasas para chequear plausibilidad" });
    return;
  }

  const dev = (rates.mep / ref - 1) * 100;
  if (Math.abs(dev) > MEP_OUTLIER_PCT) {
    issues.push({
      kind: "plausibility",
      severity: "warn",
      msg: `MEP ${rates.mep} está ${dev.toFixed(2)}% respecto del cluster cripto/CCL (ref ${ref.toFixed(2)}). ` +
           `El ROI del puré se calcula dividiendo por el MEP, así que un MEP desalineado lo distorsiona. ` +
           `Cruzá el MEP contra otra fuente antes de operar.`,
    });
  }

  if (rates.ccl && rates.mep) {
    const gap = (rates.ccl / rates.mep - 1) * 100;
    if (gap > 3) {
      issues.push({ kind: "plausibility", severity: "warn", msg: `brecha CCL–MEP de ${gap.toFixed(2)}%, más ancha de lo habitual` });
    }
  }

  // ¿Cuánto margen hay antes de que el puré dé cero?
  for (const row of table) {
    if (row.amount !== 1000) continue;
    const bestPerUsd = row.perUsd[row.best];
    const breakevenMep = bestPerUsd;
    const margin = (breakevenMep / rates.mep - 1) * 100;
    if (row.arbitrageRoiPct > 0 && margin < ROI_NOISE_PCT) {
      issues.push({
        kind: "plausibility",
        severity: "warn",
        msg: `el ROI del puré (${row.arbitrageRoiPct}%) está a solo ${margin.toFixed(2)}% del breakeven ` +
             `(MEP ${breakevenMep.toFixed(2)}); dentro del ruido de las tasas`,
      });
    }
  }
}

const issues = [];
const { rates, sources } = await fetchRates(issues);
checkSource("CommissionTracker.html", "HTML", issues);
checkSource("commission-tracker-app/src/hooks/useCommissionData.ts", "React", issues);
const table = checkRoutes(rates, issues);
checkPlausibility(rates, table, issues);

const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
const plausibility = warns.filter((i) => i.kind === "plausibility");

const liveCount = Object.values(sources).filter((s) => s === "live").length;
const totalCount = Object.keys(sources).length;

if (AS_JSON) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), rates, sources, table, issues }, null, 2));
} else {
  const header = OFFLINE
    ? "(referencia, offline)"
    : liveCount === totalCount
      ? "(en vivo)"
      : liveCount === 0
        ? "⚠ NINGUNA EN VIVO — todas son del snapshot de referencia, NO son tasas actuales"
        : `⚠ PARCIAL — solo ${liveCount}/${totalCount} en vivo, el resto es snapshot`;
  console.log(`\n  Tasas  ${header}`);
  for (const [k, v] of Object.entries(rates)) {
    const mark = OFFLINE ? "" : sources[k] === "live" ? "  · en vivo" : "  · SNAPSHOT (no actual)";
    console.log(`    ${k.padEnd(10)} ${String(v).padEnd(10)}${mark}`);
  }

  console.log(`\n  Rutas (ARS por USD)`);
  console.log(`    ${"monto".padEnd(8)} ${["R1", "R2", "R3", "R4", "R5"].map((s) => s.padStart(8)).join("")}   mejor   ROI puré`);
  for (const row of table) {
    const cells = ["R1", "R2", "R3", "R4", "R5"].map((k) => String(row.perUsd[k]).padStart(8)).join("");
    console.log(`    ${("$" + row.amount).padEnd(8)} ${cells}   ${row.best.padEnd(6)}  ${row.arbitrageRoiPct}%`);
  }

  if (plausibility.length) {
    console.log(`\n  ⚠ Plausibilidad de tasas`);
    for (const w of plausibility) console.log(`    ! ${w.msg}`);
  }
  const otherWarns = warns.filter((w) => w.kind !== "plausibility");
  if (otherWarns.length) {
    console.log(`\n  Avisos`);
    for (const w of otherWarns) console.log(`    ~ ${w.msg}`);
  }
  if (errors.length) {
    console.log(`\n  Diffs (${errors.length})`);
    for (const e of errors) console.log(`    x ${e.msg}`);
  } else {
    console.log(`\n  Sin diffs: comisiones, esquema de API y cálculo de rutas coinciden con lo esperado.`);
  }
  console.log("");
}

process.exit(errors.length || (STRICT && plausibility.length) ? 1 : 0);
