import type React from "react";

const accentStyles: Record<string, string> = {
  green: "bg-primary/10 text-primary",
  mint: "bg-chart-2/15 text-chart-2",
  yellow: "bg-chart-4/20 text-chart-4",
  blue: "bg-chart-3/15 text-chart-3",
};

interface StatCardProps {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  accent: string;
}

export function StatCard({ label, value, note, icon, accent }: StatCardProps) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </span>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-md ${accentStyles[accent]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 truncate text-xl font-semibold tabular-nums sm:text-2xl" title={value}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{note}</p>
    </article>
  );
}
