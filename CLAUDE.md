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
| `santander` | Rol especial — recibe wire de Mercury y reenvía a Belo; también es el tipo de cambio MEP de referencia para el cálculo del puré |
| Binance P2P | Solo para la ruta R5 (no tiene slug propio, usa la tasa `binanceUsdtToArs`) |

---

## Las 5 rutas de transferencia

```
R1  Mercury --ACH--> GrabrFi --USDT--> AstroPay --ARS-->  [tasa AstroPay]
R2  Mercury --ACH--> Payoneer --ACH--> Belo --ARS-->       [tasa Belo/MEP]
R3  Mercury --ACH--> GrabrFi  --ACH--> Belo --ARS-->       [tasa Belo/MEP]
R4  Mercury --Wire-> Santander ------> Belo --ARS-->        [tasa Belo/MEP] ← el wire cuesta $15
R5  Mercury --ACH--> GrabrFi --USDT--> Binance P2P --ARS-- [tasa Binance P2P]
```

**Importante:** R2, R3 y R4 liquidan todas a la tasa Belo (USDC/ARS bid de CriptoYa).
Solo R1 liquida a tasa AstroPay y R5 a Binance P2P. En la práctica, las únicas tasas
que mueven el resultado son Belo y AstroPay.

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
| Belo ACH in | 0.3% (mín $0.50) | ✅ Oficial |
| Belo Wire in | $20 | ✅ Oficial |
| Payoneer ACH in | 1% | ✅ Oficial |
| Payoneer retiro USD (≥$400) | $1.50 fijo | ✅ Oficial (desde mar-2025) |
| Payoneer retiro USD (<$400) | $4.00 fijo | ✅ Oficial (desde mar-2025) |
| AstroPay recepción | $0 | ⚠️ Estimado |
| AstroPay conversión | 2.5% | ⚠️ Estimado (sin tarifario público) |
| AstroPay ACH out | $3.50 | ⚠️ Estimado |

Los valores **estimados** son ajustables en el panel ⚙️ Mercado de la UI.
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
    ├── ComparisonCalculator     ← Calculadora USD→ARS: muestra las 5 rutas y la mejor
    ├── ArbitrageLoopCalculator  ← Calcula ROI del "puré" (USD→ARS→MEP→USD)
    ├── MarketConfigPanel        ← Panel lateral para editar tasas y comisiones manualmente
    ├── AlertsBanner             ← Alerta + notificación del navegador cuando ROI supera umbral
    ├── ExchangeRateCard         ← Card de tasa USD→ARS por billetera
    ├── HistoryChart             ← Gráfico de historial de tasas (fuente: localStorage)
    ├── TransferFlowDiagram      ← Diagrama visual del flujo de cada ruta
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
