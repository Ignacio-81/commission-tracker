# CommissionTracker

Dashboard fintech (dark, teal/cyan) que compara 4 rutas para mover USD desde **Mercury** a **ARS**, más una calculadora de arbitraje **Dólar MEP** ("puré / bucle").

## Rutas

| # | Ruta | Detalle |
|---|------|---------|
| R1 | Mercury ACH → GrabrFi → USDT (Tron/BSC) → AstroPay → ARS | vía cripto |
| R2 | Mercury ACH → Payoneer → Belo → ARS | |
| R3 | Mercury ACH → GrabrFi → Belo → ARS | suele ser la mejor |
| R4 | Mercury Wire → Santander (USD local) → Belo (spread 4% USD→USDT) → ARS | **sin** paso USDT→ARS |

## Stack

Vite 5 · React 18 · TypeScript 5 · Tailwind v3 · lucide-react · recharts.
Tasas en vivo desde **CriptoYa** (CORS abierto) directo en el navegador — sin backend obligatorio.
Configuración editable persistida en `localStorage`.

## Correr local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build de producción
```

## Mejoras incluidas vs. la versión anterior

- **Tasas 100% en vivo**: MEP, CCL, cripto AstroPay/Belo desde CriptoYa, con auto-refresh cada 5 min y al enfocar la pestaña. Sin valores hardcodeados (los defaults son solo fallback).
- **Gráfico histórico**: cada actualización guarda un snapshot de la mejor tasa efectiva y se grafica su evolución (recharts + localStorage).

## Edición manual (panel "Mercado")

Cualquier tasa o comisión es editable. Una clave editada manualmente:
1. se marca con badge **"Manual"** en todas las vistas,
2. tiene **precedencia** sobre el refresh de la API,
3. sobrevive a recargas (persistida en `localStorage`).

"Restablecer valores" borra overrides y vuelve a tasas en vivo.

## Reglas de negocio (no deben regresar)

| Regla | Valor | Fuente |
|---|---|---|
| Mercury Wire internacional | $15 USD fijo | editable |
| Mercury ACH out | $0 | editable |
| GrabrFi ACH out | 0.3% (mín $1, máx $5) | docs oficiales |
| GrabrFi USD→USDT | 0.8% | editable |
| GrabrFi USDT withdraw | 1.1% + $1 | editable |
| Belo ACH in | 0.3% (mín $0.50) | editable |
| Belo spread local USD→USDT | 4% (**solo** ruta Santander) | editable |
| Payoneer ACH in / out | 1% / 2% | docs oficiales |
| AstroPay depósito | gratis | docs oficiales |
| GrabrFi / Santander USD→ARS | Dólar MEP | live (CriptoYa) |
| Payoneer USD→ARS | CCL × 0.99 | live |
| Belo / AstroPay USD→ARS | CriptoYa por exchange | live |

> ⚠️ **Bug crítico a evitar:** la ruta Santander NO aplica conversión USDT→ARS. El 4% de spread es la única deducción entre Santander USD y Belo USD; el paso final usa `belo.usdToArsRate` directo.

## Backend opcional (Supabase)

`supabase/functions/get-exchange-rates/index.ts` replica el fetch en una Edge Function (Deno) y permite scraping opcional con `FIRECRAWL_API_KEY`. La app funciona sin esto. Deploy:

```bash
supabase functions deploy get-exchange-rates --no-verify-jwt
```

## Estructura

```
src/
  types/commission.ts          tipos de dominio
  lib/criptoya.ts              fetch de tasas en vivo
  lib/format.ts               formato es-AR
  hooks/useCommissionData.ts  estado, persistencia, calculateComparison()
  components/                 Header, ExchangeRateCard, WalletCard,
                              TransferFlowDiagram, RatesTable, MarketConfigPanel,
                              ComparisonCalculator, ArbitrageLoopCalculator, HistoryChart
  pages/Index.tsx             composición
supabase/functions/get-exchange-rates/index.ts   backend opcional
```

*Herramienta informativa — no constituye asesoramiento financiero.*
