# CommissionTracker — Contexto del proyecto

Herramienta para comparar rutas de transferencia **USD → ARS** y calcular el ROI
del arbitraje MEP ("puré"). Orientada a argentinos que cobran en dólares y quieren
maximizar la conversión a pesos.

---

## Dos versiones del mismo producto

| Archivo / Carpeta | Descripción |
|---|---|
| `CommissionTracker.html` | Versión standalone — HTML + CSS + JS en un solo archivo, sin dependencias ni build. Se abre directo en el navegador. |
| `commission-tracker-app/` | Versión React/TypeScript con Vite. Más mantenible; la misma lógica de negocio. |

Cuando se haga un cambio de lógica (comisiones, rutas, fórmulas), **aplicarlo en ambas versiones** salvo que se indique lo contrario.

---

## Stack (React app)

- **React 18** + **TypeScript strict**
- **Vite 5** como bundler y dev server
- **Tailwind CSS 3** para estilos
- **Recharts 2** para el gráfico de historial
- **Lucide React** para iconos
- Sin router (single page), sin estado global externo — todo vive en `useCommissionData`
- Persistencia: `localStorage` únicamente (sin backend activo; hay una carpeta `supabase/functions/` con un Edge Function opcional que no se usa)
- Para levantar: `npm run dev` desde `commission-tracker-app/`, o doble clic en `Iniciar app.bat`

---

## Billeteras y entidades soportadas

| Slug | Rol en las rutas |
|---|---|
| `mercury` | Origen siempre — cuenta USD en EE.UU. desde donde salen los fondos |
| `grabrfi` | Intermediario — recibe por ACH desde Mercury, convierte USD→USDT, envía a cripto |
| `astropay` | Destino cripto — recibe USDT y permite retiro en ARS |
| `belo` | Destino principal — recibe USD por ACH desde GrabrFi o Payoneer, convierte a ARS vía MEP |
| `payoneer` | Intermediario alternativo — recibe de Mercury y reenvía a Belo |
| `santander` | Destino directo — recibe wire de Mercury y liquida ahí mismo a ARS operando el dólar MEP (ya no reenvía a Belo); también es el tipo de cambio MEP de referencia para el cálculo del puré |
| `takenos` | Destino directo — recibe ACH de Mercury vía cuenta FBO y retira directo a CBU/CVU en ARS, sin intermediarios |
| Binance P2P | Solo para la ruta R5 (no tiene slug propio, usa la tasa `binanceUsdtToArs`) |

---

## Las 6 rutas de transferencia

```
R1  Mercury --ACH--> GrabrFi --USDT--> AstroPay --ARS-->  [tasa AstroPay]
R2  Mercury --ACH--> Payoneer --ACH--> Belo --ARS-->       [tasa Belo/MEP]
R3  Mercury --ACH--> GrabrFi  --ACH--> Belo --ARS-->       [tasa Belo/MEP]
R4  Mercury --Wire-> Santander --Dólar MEP--> ARS -->       [tasa Santander/MEP] ← el wire cuesta $15
R5  Mercury --ACH--> GrabrFi --USDT--> Binance P2P --ARS-- [tasa Binance P2P]
R6  Mercury --ACH--> Takenos ------------------> ARS -->   [tasa Takenos, ≈ dólar cripto] ← 0% en todos los pasos
```

**Importante:** R2 y R3 liquidan a la tasa Belo (USDC/ARS bid de CriptoYa). R4 liquida
directo en Santander a la tasa MEP (sin pasar por Belo). R1 liquida a tasa AstroPay, R5
a Binance P2P y R6 a la tasa Takenos (estimada con el dólar cripto, ver abajo). En la
práctica, las únicas tasas que mueven el resultado son Belo, AstroPay, MEP y Takenos.

**Sobre R6 (Takenos).** Es la ruta más simple del modelo: sale de Mercury por ACH
(comisión `mercuryAchOut`, hoy $0) y Takenos no cobra nada ni en la recepción ACH ni en
el retiro a CBU/CVU (0% documentado por el proveedor). No hay comisiones editables
específicas de Takenos en el panel ⚙️ Mercado porque no hay nada que ajustar: los tres
pasos están hardcodeados en 0 en `calculateComparison()`.

**Sobre la tasa de Takenos.** Primero se estimó como `= MEP` (mismo criterio que
GrabrFi/Santander), pero verificación cruzada contra la app de Takenos (sep-2026) mostró
un desvío de ~3% — Takenos opera con USDC internamente, no con el bono AL30 del MEP. Se
corrigió para usar el **dólar cripto** de `dolarapi.com` (`/v1/dolares/cripto`, campo
`compra`), que en la misma verificación quedó a ~0.2% de la tasa real in-app. Fallback a
MEP si `dolarapi.com` no responde. Ver `fetchLiveRates()` en `lib/criptoya.ts`.

---

## Tasas en vivo — API CriptoYa

Fuente: `https://criptoya.com` — CORS abierto, se llama directo desde el navegador.

| Variable | Endpoint CriptoYa | Campo |
|---|---|---|
| Belo USDC/ARS | `/api/belo/usdc/ars/1` | `totalBid` |
| AstroPay USDT/ARS | `/api/astropay/usdt/ars/1` | `totalBid` |
| Binance P2P USDT/ARS | `/api/binancep2p/usdt/ars/1` | `totalBid` |
| Dólar MEP (AL30 24hs) | `/api/dolar` | `mep.al30["24hs"].price` |
| Dólar CCL (AL30 24hs) | `/api/dolar` | `ccl.al30["24hs"].price` |
| Payoneer (estimado) | — | `CCL × 0.99` |
| GrabrFi / Santander | — | `= MEP` |

Fuente adicional: `https://dolarapi.com` — CORS abierto.

| Variable | Endpoint dolarapi.com | Campo |
|---|---|---|
| Dólar cripto (Takenos, estimado) | `/v1/dolares/cripto` | `compra`, con fallback a MEP |

Refresco automático: cada **5 minutos** + al volver a la pestaña (visibilitychange).

---

## Comisiones hardcodeadas — estado de verificación (jun-2026)

| Wallet | Comisión | Estado |
|---|---|---|
| Mercury ACH out | $0 | ✅ Oficial |
| Mercury Wire intl | $15 | ✅ Oficial (opción conservadora "OUR") |
| GrabrFi ACH out | 0.3% (mín $1, máx $5) | ✅ Oficial |
| GrabrFi USDT withdraw | 1.1% + $1 fijo | ✅ Oficial |
| GrabrFi Wire in | $5 (US doméstico) | ✅ Oficial |
| GrabrFi USD→USDT | 0.8% | ⚠️ Estimado (se muestra in-app antes de confirmar) |
| Belo ACH in | **0.5%** (mín $0.50) | 🔬 **Medido** 5-ago-2026 — el tarifario público dice 0.3%, la operación real descontó 6,50 sobre 1300 USDC (0,500%). El valor medido tiene precedencia. |
| Belo Wire in | $20 | ✅ Oficial |
| Payoneer ACH in | 1% | ✅ Oficial |
| Payoneer retiro USD (≥$400) | $1.50 fijo | ✅ Oficial (desde mar-2025) |
| Payoneer retiro USD (<$400) | $4.00 fijo | ✅ Oficial (desde mar-2025) |
| AstroPay recepción | $0 | ⚠️ Estimado — ajustable en panel |
| AstroPay conversión | 2.5% | ℹ️ Solo informativo — **no se usa en el cálculo** (ver abajo) |
| AstroPay ACH out | $3.50 | ℹ️ Solo informativo — **no se usa en el cálculo** |
| Takenos ACH in | 0% | ✅ Oficial (ficha del proveedor) |
| Takenos retiro CBU/CVU | 0% | ✅ Oficial (ficha del proveedor) |

**Qué es editable y qué no.** Son ajustables en el panel ⚙️ Mercado únicamente los campos
listados en `FEE_FIELDS` (`MarketConfigPanel.tsx`). `astropayConversion` (2.5%) y
`astropayAchOut` ($3.50) **no** están en `MarketConfig`: son literales dentro de
`buildCommissions()` que solo alimentan la tabla `RatesTable`. No los edites esperando que
cambien un resultado — no participan de `calculateComparison()`.

**Por qué el 2.5% de AstroPay no se descuenta.** `astropayUsdtToArs` sale de CriptoYa
`totalBid`, que ya viene **neto de las comisiones del exchange**. Restar el 2.5% otra vez
sería contarlo dos veces. Mismo criterio para Binance P2P en R5. La tabla lo muestra con un
asterisco y nota al pie.

**Sobre R4 (Santander).** Liquida directo a ARS en Santander operando el dólar MEP, sin
pasar por Belo: no hay spread ni comisión de conversión adicional que modelar (mismo
criterio que R1/R5 con el `totalBid` de CriptoYa). El único costo de la ruta es el wire
de Mercury ($15). `santander.usdToArsRate` ya es la tasa MEP (`= MEP` en `criptoya.ts`).

El panel marca como "Manual" cualquier campo que el usuario haya editado manualmente,
y esos valores tienen precedencia sobre los que traen las APIs.

---

## Arquitectura interna

```
src/
├── hooks/useCommissionData.ts   ← NÚCLEO. Toda la lógica: fetch, cálculos, persistencia
├── lib/criptoya.ts              ← Cliente HTTP para CriptoYa
├── lib/format.ts                ← fmtARS / fmtUSD / fmtNum
├── types/commission.ts          ← WalletCommission | TransferPath | TransferStep | ComparisonResult
├── pages/Index.tsx              ← Layout principal, orquesta todos los componentes
└── components/
    ├── ComparisonCalculator     ← Calculadora USD→ARS: muestra las 6 rutas y la mejor
    ├── ArbitrageLoopCalculator  ← Calcula ROI del "puré" (USD→ARS→MEP→USD)
    ├── MarketConfigPanel        ← Panel lateral para editar tasas y comisiones manualmente
    ├── AlertsBanner             ← Alerta + notificación del navegador cuando ROI supera umbral
    ├── ExchangeRateCard         ← Card de tasa USD→ARS por billetera
    ├── HistoryChart             ← Gráfico de historial de tasas (fuente: localStorage)
    ├── RatesTable               ← Tabla comparativa de comisiones
    ├── Header                   ← Cabecera con timestamp de último refresh y botón de refresh
    └── WalletCard               ← Card genérica de billetera
```

### Persistencia en localStorage

| Key | Contenido |
|---|---|
| `marketConfig.v1` | Objeto `MarketConfig` con todos los valores del panel |
| `marketConfig.manualKeys.v1` | Array de keys que el usuario editó manualmente |
| `history.v1` | Array de hasta 500 `HistoryPoint` (timestamp, tasa, ruta ganadora) |
| `alerts.v1` | Config de alertas: umbral % y si las notificaciones están activas |

---

## Funcionalidad de arbitraje ("puré")

El `ArbitrageLoopCalculator` simula el ciclo:
1. Partir de USD
2. Convertir a ARS por la mejor ruta disponible
3. Volver a USD comprando al tipo de cambio MEP (vía Santander)
4. Calcular el profit y ROI del ciclo

`AlertsBanner` monitorea ese ROI en cada refresh y puede disparar una
**notificación nativa del navegador** cuando el ROI supera el umbral configurado.

---

## Convenciones del código

- No hay router; la app es una sola página
- TypeScript en modo `--strict` (0 errores como invariante)
- Todos los cálculos de rutas viven en `useCommissionData.ts:calculateComparison()`
- La función `clamp()` se usa para aplicar mínimos y máximos a comisiones porcentuales
- Las tasas que el usuario NO ha editado manualmente se sobreescriben en cada refresh
- Las tasas manuales se preservan hasta que el usuario presione "Restablecer valores"

---

## Archivos de referencia y auditoría

- `AUDITORIA-tasas-y-comisiones.md` — registro de verificación de cada comisión contra fuentes oficiales, con las correcciones aplicadas y lo que queda pendiente de validar manualmente.
