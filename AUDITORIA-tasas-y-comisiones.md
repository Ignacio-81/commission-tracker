# Auditoría de tasas de conversión y comisiones — CommissionTracker

**Fecha:** 22-jun-2026 · **Alcance:** `CommissionTracker.html` + `commission-tracker-app` (React)

---

## 1. Resumen ejecutivo

Las tasas de conversión que **realmente afectan el resultado** ya se actualizan en vivo y están bien implementadas. Las comisiones hardcodeadas están mayormente correctas según fuentes oficiales, salvo **un error: la comisión de retiro de Payoneer estaba modelada como 2% cuando desde marzo 2025 es un fee fijo (~US$1,50)**. Ya quedó corregido en ambas versiones.

---

## 2. Tasas de conversión (FX)

| Tasa | Fuente en el código | ¿En vivo? | Estado |
|---|---|---|---|
| Belo USDC→ARS | CriptoYa `/belo/usdc/ars` · `totalBid` | ✅ Sí | Correcto. Belo acredita en USDC, por eso se consulta USDC (no USDT) y se usa el **bid** (lo que recibís al vender). |
| AstroPay USDT→ARS | CriptoYa `/astropay/usdt/ars` · `totalBid` | ✅ Sí | Correcto (bid real). |
| Dólar MEP | CriptoYa `/dolar` · `mep.al30.24hs` | ✅ Sí | Correcto. Es la pata de "recompra" del puré. |
| Dólar CCL | CriptoYa `/dolar` · `ccl.al30.24hs` | ✅ Sí | Correcto. |
| Payoneer USD→ARS | `CCL × 0.99` | ⚠️ Deducido | Solo informativo (la ruta Payoneer liquida en Belo, usa la tasa Belo). Proxy razonable. |
| GrabrFi / Santander USD→ARS | `= MEP` | ⚠️ Deducido | Solo informativo (ambas rutas liquidan en Belo). No hay API pública de su tasa interna. |

**Verificado contra las APIs en vivo (jun-2026):** las 3 llamadas a CriptoYa responden y la estructura del JSON coincide exactamente con el parseo del código (`mep.al30["24hs"].price`, `totalBid`, etc.). El refresco automático (cada 5 min + al volver a la pestaña) y el fallback a último valor guardado funcionan.

> **Dato clave:** de las 4 rutas, solo **R1 (AstroPay)** liquida a la tasa AstroPay; **R2, R3 y R4 liquidan todas a la tasa de Belo (USDC bid)**. Por eso las únicas tasas que mueven el resultado final son Belo y AstroPay, y ambas son en vivo. ✔

---

## 3. Comisiones — verificación contra fuentes oficiales

| Wallet | Comisión (código) | Oficial | Estado |
|---|---|---|---|
| **Mercury** | ACH out $0 · Wire intl $15 | ACH gratis · USD wire intl gratis (SHA) o $15 opción "OUR" que cubre fees del receptor | ✅ Correcto ($15 = opción conservadora que cubre intermediarios) |
| **GrabrFi** | ACH out 0.3% (mín $1, máx $5) · USDT withdraw 1.1% + $1 | Idéntico (vigente desde 6-ene-2025) | ✅ Correcto |
| **GrabrFi** wire incoming | $5 | US doméstico $5 · internacional $20 | ✅ OK como doméstico (Mercury→GrabrFi es US-US). Nota: si fuera intl serían $20 |
| **Belo** | ACH in 0.3% (mín $0.5) · Wire in $20 | Idéntico · además apertura cuenta USD $3/año | ✅ Correcto |
| **Payoneer** | ACH in 1% | ACH/eCheck de clientes US = 1% | ✅ Correcto |
| **Payoneer** | ~~ACH out 2%~~ → **fijo $1.5 (o $4 si <$400)** | Desde mar-2025: retiro USD→USD = $1.50 fijo (<$50k/mes); $4 si monto <$400; 0.5% si >$50k/mes | 🔧 **CORREGIDO** |
| **Payoneer** | ~~monthly fee $25~~ → 0 | No existe fee mensual de $25; hay cargo anual de inactividad (~$29.95/año si recibís poco) | 🔧 Ajustado (no se usaba en el cálculo) |
| **AstroPay** | recepción $0 · conversión 2.5% · ACH out $3.5 | Sin tarifario público (Anexo 1, se ve in-app) | ⚠️ **Estimado** — verificar en la app y ajustar en el panel |
| **GrabrFi** USD→USDT | 0.8% | No publicado (se muestra in-app antes de confirmar) | ⚠️ **Estimado** — ajustable en el panel |

---

## 4. Cambios aplicados

- **Payoneer retiro:** se reemplazó el 2% porcentual por un modelo de **fee fijo** (`payoneerAchOutFixed` $1.5, `payoneerAchOutSmall` $4 bajo umbral `payoneerSmallThreshold` $400). Impacto medido con tasas reales: en US$1.000 mejora el resultado de Payoneer ~1.9% (estaba sobre-penalizada); en US$200 queda casi igual (el fee de $4 ≈ 2%). Payoneer pasa a ser ruta competitiva, segunda detrás de GrabrFi.
- **Etiquetas honestas:** el footer ahora distingue qué es **en vivo** (Belo, AstroPay, MEP, CCL), qué está **verificado oficialmente** (Mercury, GrabrFi, Belo, Payoneer) y qué es **estimado** (AstroPay, GrabrFi USD→USDT).
- Aplicado en paralelo a `CommissionTracker.html` y a la app React (`useCommissionData.ts`, `MarketConfigPanel.tsx`, `Index.tsx`).

## 5. Verificación

- 3 APIs de CriptoYa probadas en vivo: estructura JSON coincide con el parseo. ✔
- Cálculo de las 4 rutas corrido en Node con tasas reales (Belo 1511.14, AstroPay 1476.67, MEP 1478.02): sin errores, resultados coherentes, puré ROI +1.4% a +1.8%. ✔
- TypeScript de la app en modo `--strict`: 0 errores. ✔

## 6. Pendiente para vos (no automatizable)

Las únicas comisiones sin fuente pública (**AstroPay** recepción/conversión y **GrabrFi USD→USDT**) no tienen API ni tarifario web — se muestran in-app antes de confirmar. Hacé una operación chica de prueba, mirá el fee real y cargalo en el panel **⚙️ Mercado** (queda marcado "Manual" y tiene precedencia sobre cualquier valor).

---

### Fuentes
- Mercury — [Covering recipient fees for USD international wires](https://support.mercury.com/hc/en-us/articles/28773111244436-Covering-recipient-fees-for-USD-international-wires) · [Pricing](https://mercury.com/pricing)
- GrabrFi — [Full schedule of fees](https://help.grabrfi.com/en/content/full-schedule-of-fees) · [Stablecoin transfer fees](https://help.grabrfi.com/en/content/what-are-the-fees-and-processing-times-for-transfers)
- Belo — [Your US dollar account (ACH & Wire) FAQs](https://help.belo.app/en/articles/9883300-your-us-dollar-account-ach-wire-faqs)
- Payoneer — [Pricing](https://www.payoneer.com/about/pricing/) · [How Payoneer calculates withdrawal fees](https://www.payoneer.com/resources/how-to-use-payoneer/how-payoneer-calculates-withdrawal-fees/)
- AstroPay — [Cuenta multimoneda](https://www.astropay.com/multicurrency-account) (tarifas en Anexo 1, in-app)
