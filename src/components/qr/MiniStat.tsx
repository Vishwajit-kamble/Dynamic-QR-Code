interface MiniStatProps {
  label: string;
  value: string;
  className?: string;
}

export function MiniStat({ label, value, className = "" }: MiniStatProps) {
  return (
    <div className={`rounded-lg border border-border bg-card p-3.5 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
