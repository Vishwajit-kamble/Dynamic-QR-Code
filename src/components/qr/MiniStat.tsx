interface MiniStatProps {
  label: string;
  value: string;
  className?: string;
  inlineOnMobile?: boolean;
}

export function MiniStat({ label, value, className = "", inlineOnMobile = false }: MiniStatProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-3 sm:p-3.5 ${
        inlineOnMobile ? "flex items-center justify-between gap-2 sm:block" : ""
      } ${className}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`${inlineOnMobile ? "sm:mt-1.5" : "mt-1.5"} text-lg font-semibold tabular-nums`}
      >
        {value}
      </p>
    </div>
  );
}
