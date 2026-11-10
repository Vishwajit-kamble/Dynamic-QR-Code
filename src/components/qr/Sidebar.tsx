import { BarChart3, CircleHelp, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { View } from "@/components/qr/types";

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  codesCount: number;
}

export function Sidebar({ view, setView, codesCount }: SidebarProps) {
  return (
    <aside className="hidden border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-[76px] items-center gap-3 border-b border-border px-6">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <QrCode className="size-5" />
        </div>
        <span className="text-[17px] font-semibold">
          qr<span className="text-primary">studio</span>
        </span>
      </div>
      <div className="px-3 pt-7">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <nav className="space-y-1" aria-label="Workspace navigation">
          <Button
            variant="ghost"
            onClick={() => setView("overview")}
            aria-current={view === "overview" ? "page" : undefined}
            className={`h-10 w-full justify-start px-3 ${view === "overview" ? "bg-accent text-primary" : "text-muted-foreground"}`}
          >
            <BarChart3 /> Overview
          </Button>
          <Button
            variant="ghost"
            onClick={() => setView("codes")}
            aria-current={view === "codes" ? "page" : undefined}
            className={`h-10 w-full justify-start px-3 ${view === "codes" ? "bg-accent text-primary" : "text-muted-foreground"}`}
          >
            <QrCode /> My QR codes{" "}
            <span className="ml-auto text-xs text-muted-foreground">{codesCount}</span>
          </Button>
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
          <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-medium">Dynamic links</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Change a destination anytime; your printed code stays the same.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
