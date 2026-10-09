// Genera widget.json (lo corre la GitHub Action cada pocos minutos).
// Uso: npx tsx src/build.ts [salida.json] [monto]
import { writeFileSync } from "node:fs";
import { buildPayload, DEFAULT_AMOUNT } from "./payload";

const out = process.argv[2] ?? "widget.json";
const amount = Number(process.argv[3]) || DEFAULT_AMOUNT;
const payload = await buildPayload(amount);
writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify(payload));
