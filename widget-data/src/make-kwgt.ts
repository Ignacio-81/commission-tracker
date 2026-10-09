// Genera el preset de KWGT (widget 4×2, texto sobre fondo transparente) que lee widget.json.
// Uso: npx tsx src/make-kwgt.ts [salida.kwgt]
//
// El formato (.kwgt = ZIP con preset.json en la raíz) se dedujo de presets públicos reales;
// no hay documentación oficial del esquema. Todos los tamaños se escalan con la global `u`
// (= ancho del widget / 320) para que el diseño de 320×160 se adapte a cualquier tamaño.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { zipSync, strToU8 } from "fflate";

const JSON_URL = "https://raw.githubusercontent.com/Ignacio-81/commission-tracker/widget-json/widget.json";
const wg = (path: string) => `wg("${JSON_URL}", json, ${path})`;
const d = (path: string) => wg(`.display.${path}`);

// Colores (ARGB)
const DIM = "#B3FFFFFF"; // blanco al 70%
const RULE = "#38FFFFFF"; // línea fina
const GREEN = "#FF4ADE80";
const RED = "#FFFCA5A5";
const CLEAR = "#00000000";

type Anchor = "TOPLEFT" | "TOPRIGHT" | "BOTTOMLEFT" | "BOTTOMRIGHT" | "CENTERLEFT" | "CENTERRIGHT" | "TOP" | "CENTER";

interface TextOpts {
  title: string;
  expr: string;          // texto fijo o fórmula "$...$"
  size: number;          // en unidades del diseño (px de 320 de ancho)
  anchor?: Anchor;
  padLeft?: number;
  align?: "LEFT" | "RIGHT" | "CENTER";
  color?: string;        // color fijo
  colorFormula?: string; // color dinámico (sin los $)
  bold?: boolean;
}

function text(o: TextOpts) {
  const toggles: Record<string, number> = { text_size: 10 };
  const formulas: Record<string, string> = { text_size: `$gv(u)*${o.size}$` };
  const m: Record<string, unknown> = {
    internal_type: "TextModule",
    internal_title: o.title,
    text_expression: o.expr,
    text_size: Math.round(o.size * 1.9),
    text_align: o.align ?? "LEFT",
  };
  if (o.anchor) m.position_anchor = o.anchor;
  if (o.padLeft) {
    m.position_padding_left = Math.round(o.padLeft * 1.9);
    toggles.position_padding_left = 10;
    formulas.position_padding_left = `$gv(u)*${o.padLeft}$`;
  }
  if (o.colorFormula) {
    toggles.paint_color = 10;
    formulas.paint_color = `$${o.colorFormula}$`;
  } else if (o.color) {
    m.paint_color = o.color;
  }
  m.internal_toggles = toggles;
  m.internal_formulas = formulas;
  return m;
}

// Rectángulo (transparente = separador/ancho fijo de la fila, o la línea fina del divisor)
function rect(title: string, wUnits: number, hUnits: number, color: string) {
  return {
    internal_type: "ShapeModule",
    internal_title: title,
    shape_type: "RECT",
    shape_width: Math.round(wUnits * 1.9),
    shape_height: Math.max(1, Math.round(hUnits * 1.9)),
    paint_color: color,
    internal_toggles: { shape_width: 10, shape_height: 10 },
    internal_formulas: { shape_width: `$gv(u)*${wUnits}$`, shape_height: `$gv(u)*${hUnits}$` },
  };
}

const overlap = (title: string, items: unknown[]) => ({
  internal_type: "OverlapLayerModule",
  internal_title: title,
  viewgroup_items: items,
});

const W = 320; // ancho de diseño

// Color de una tasa: rojo si falló, verde si es la mejor, blanco el resto
const rowColor = (i: number) =>
  `if(${d(`rows[${i}].isError`)}=1, ${RED}, if(${d(`rows[${i}].isBest`)}=1, ${GREEN}, #FFFFFFFF))`;

const row = (i: number) =>
  overlap(`Fila ${i + 1}`, [
    rect("ancho", W, 24, CLEAR),
    text({ title: "puesto", expr: `$${d(`rows[${i}].rank`)}$`, size: 11, anchor: "CENTERLEFT", color: DIM }),
    text({ title: "nombre", expr: `$${d(`rows[${i}].name`)}$`, size: 14, anchor: "CENTERLEFT", padLeft: 16 }),
    text({
      title: "tasa", expr: `$${d(`rows[${i}].value`)}$`, size: 16, anchor: "CENTERRIGHT", align: "RIGHT",
      colorFormula: rowColor(i),
    }),
  ]);

const header = overlap("Encabezado", [
  rect("ancho", W, 18, CLEAR),
  text({ title: "titulo", expr: "USD → ARS", size: 11, anchor: "CENTERLEFT", color: DIM }),
  text({
    title: "estado", expr: `$${d("header")}$`, size: 11, anchor: "CENTERRIGHT", align: "RIGHT",
    colorFormula: `if(${d("hasErrorNum")}=1, ${RED}, #B3FFFFFF)`,
  }),
]);

const route = overlap("Mejor ruta", [
  rect("ancho", W, 38, CLEAR),
  text({ title: "etiqueta", expr: "MEJOR RUTA", size: 10, anchor: "TOPLEFT", color: DIM }),
  text({ title: "ruta", expr: `$${d("routeName")}$`, size: 12, anchor: "BOTTOMLEFT" }),
  text({ title: "total", expr: `$${d("routeTotal")}$`, size: 17, anchor: "TOPRIGHT", align: "RIGHT", color: GREEN }),
  text({ title: "monto", expr: `$${d("routeCaption")}$`, size: 10, anchor: "BOTTOMRIGHT", align: "RIGHT", color: DIM }),
]);

const preset = {
  preset_info: {
    archive: null,
    author: "",
    description: "Top 3 de tasas USD→ARS y mejor ruta (lee widget.json de GitHub)",
    email: "",
    features: "",
    pflags: 0,
    height: 400,
    locked: false,
    release: 377435216,
    title: "TasasUSDARS",
    version: 13,
    width: 800,
    xscreens: 0,
    yscreens: 0,
  },
  preset_root: {
    internal_type: "RootLayerModule",
    globals_list: {
      u: {
        index: 1,
        type: "NUMBER",
        title: "u",
        toggles: 10,
        global_formula: "$si(rwidth)/320$",
        min: 0,
        max: 20,
        value: 1.9,
      },
    },
    viewgroup_items: [
      {
        internal_type: "StackLayerModule",
        internal_title: "Widget",
        config_stacking: "VERTICAL_CENTER",
        config_margin: 2.0,
        internal_toggles: { config_margin: 10 },
        internal_formulas: { config_margin: "$gv(u)*2$" },
        viewgroup_items: [
          header,
          rect("espacio", 1, 4, CLEAR),
          row(0),
          row(1),
          row(2),
          rect("espacio", 1, 4, CLEAR),
          rect("linea", W, 1, RULE),
          rect("espacio", 1, 4, CLEAR),
          route,
        ],
      },
    ],
  },
};

const out = process.argv[2] ?? "kwgt/Tasas-USD-ARS.kwgt";
mkdirSync(dirname(out), { recursive: true });
// preset.json en la raíz del ZIP, sin carpetas (un ZIP con carpeta contenedora no se importa)
writeFileSync(out, zipSync({ "preset.json": strToU8(JSON.stringify(preset, null, 2)) }, { level: 6 }));
console.log(`OK → ${out}`);
