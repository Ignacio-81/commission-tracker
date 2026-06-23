import { RefreshCw, Activity } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  lastRefresh: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
  rightSlot?: ReactNode;
}

export default function Header({ lastRefresh, isLoading, onRefresh, rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-cyan-400 text-primary-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold gradient-text">CommissionTracker</h1>
          <p className="text-xs text-muted-foreground">Mercury • Astropay • Belo</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" />
            Última actualización: {lastRefresh ? lastRefresh.toLocaleTimeString("es-AR") : "—"}
          </span>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-semibold transition hover:border-primary/60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Actualizar
          </button>
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
