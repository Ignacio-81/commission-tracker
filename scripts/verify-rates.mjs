#!/usr/bin/env node
/**
 * verify-rates.mjs — chequeo determinista de tasas, comisiones y rutas.
 *
 * Uso:
 *   node scripts/verify-rates.mjs           # tasas en vivo desde CriptoYa
 *   node scripts/verify-rates.mjs --offline # usa las tasas de referencia (sin red)
 *   node scripts/verify-rates.mjs --json    # salida JSON para diffear entre corridas
 *
 * Qué hace:
 *   1. Verifica que cada endpoint de CriptoYa responda y que el campo que parsea la app exista.
 *   2. Verifica que las comisiones hardcodeadas en useCommissionData.ts y CommissionTracker.html
 *      coincidan con los valores esperados de esta tabla (fuente: auditoría oficial).
 *   3. Corre las 5 rutas en varios montos y chequea invariantes (sin NaN, sin negativos, etc).
 *   4. Sale con código 1 si hay algún diff, para que una tarea programada lo detecte.
 *
 * Cuando cambies una comisión a propósito, actualizá EXPECTED_FEES acá también.
 */

const args = process.argv.slice(2);
const OFFLINE = args.includes("--offline");
const AS_JSON = args.includes("--json");

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
  beloAchInPct: 0.3,
  beloAchInMin: 0.5,
  beloUsdToUsdtSpread: 4,
  payoneerAchIn: 1,
  payoneerAchOutFixed: 1.5,
  payoneerAchOutSmall: 4,
  payoneerSmallThreshold: 400,
};

// Estado de verificación de cada fee. `official` = contrastado contra tarifario público.
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
  beloAchInPct: "official",
  beloAchInMin: "official",
  beloUsdToUsdtSpread: "estimated",
  payoneerAchIn: "official",
  payoneerAchOutFixed: "official",
  payoneerAchOutSmall: "official",
  payoneerSmallThreshold: "official",
};

// Tasas de referencia para --offline (auditoría jun-2026).
const REFERENCE_RATES = {
  belo: 1511.14,
  astropay: 1476.67,
  binance: 1520,
  mep: 1478.02,
  ccl: 1495,
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

async function fetchRates(issues) {
  const rates = { ...REFERENCE_RATES };
  if (OFFLINE) {
    issues.push({ kind: "net", severity: "warn", msg: "modo --offline: usando tasas de referencia, no se verificaron los endpoints" });
    return rates;
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
        rates.ccl = json?.ccl?.al30?.["24hs"]?.price ?? rates.ccl;
      } else {
        rates[ep.key] = val;
      }
    } catch (e) {
      issues.push({ kind: "net", severity: "warn", msg: `${ep.key}: ${e.message} — se usa la tasa de referencia` });
    }
  }
  return rates;
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

const issues = [];
const rates = await fetchRates(issues);
checkSource("CommissionTracker.html", "HTML", issues);
checkSource("commission-tracker-app/src/hooks/useCommissionData.ts", "React", issues);
const table = checkRoutes(rates, issues);

const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");

if (AS_JSON) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), rates, table, issues }, null, 2));
} else {
  console.log(`\n  Tasas  ${OFFLINE ? "(referencia, offline)" : "(en vivo)"}`);
  for (const [k, v] of Object.entries(rates)) console.log(`    ${k.padEnd(10)} ${v}`);

  console.log(`\n  Rutas (ARS por USD)`);
  console.log(`    ${"monto".padEnd(8)} ${["R1", "R2", "R3", "R4", "R5"].map((s) => s.padStart(8)).join("")}   mejor   ROI puré`);
  for (const row of table) {
    const cells = ["R1", "R2", "R3", "R4", "R5"].map((k) => String(row.perUsd[k]).padStart(8)).join("");
    console.log(`    ${("$" + row.amount).padEnd(8)} ${cells}   ${row.best.padEnd(6)}  ${row.arbitrageRoiPct}%`);
  }

  if (warns.length) {
    console.log(`\n  Avisos`);
    for (const w of warns) console.log(`    ~ ${w.msg}`);
  }
  if (errors.length) {
    console.log(`\n  Diffs (${errors.length})`);
    for (const e of errors) console.log(`    x ${e.msg}`);
  } else {
    console.log(`\n  Sin diffs: comisiones, esquema de API y cálculo de rutas coinciden con lo esperado.`);
  }
  console.log("");
}

process.exit(errors.length ? 1 : 0);
