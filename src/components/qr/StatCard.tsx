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
  const isLongValue = value.length > 8;

  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <span className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
          {label}
        </span>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-md sm:size-8 ${accentStyles[accent]}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-2.5 font-semibold tabular-nums sm:mt-3 ${
          isLongValue
            ? "line-clamp-2 break-words text-sm leading-snug sm:text-base sm:leading-snug lg:text-lg"
            : "truncate text-xl leading-none sm:text-2xl sm:leading-tight"
        }`}
        title={value}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{note}</p>
    </article>
  );
}
