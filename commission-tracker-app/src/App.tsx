import { useState } from "react";
import Index from "./pages/Index";
import IndexV2 from "./pages/IndexV2";

type Version = "v1" | "v2";
const STORAGE_KEY = "appVersion.v1";

export default function App() {
  const [version, setVersion] = useState<Version>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return saved === "v2" ? "v2" : "v1";
  });

  const switchTo = (v: Version) => {
    setVersion(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen">
      {/* Selector de versión — v1 (rutas fijas) / v2 (optimizador) */}
      <div className="sticky top-0 z-50 flex justify-center border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => switchTo("v1")}
            aria-pressed={version === "v1"}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              version === "v1"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            v1 · Rutas fijas
          </button>
          <button
            type="button"
            onClick={() => switchTo("v2")}
            aria-pressed={version === "v2"}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              version === "v2"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            v2 · Optimizador
          </button>
        </div>
      </div>

      {version === "v1" ? <Index /> : <IndexV2 />}
    </div>
  );
}
