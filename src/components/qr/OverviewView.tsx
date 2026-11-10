import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ExternalLink,
  Globe2,
  Link2,
  Monitor,
  QrCode,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/qr/StatCard";
import { EmptyMini } from "@/components/qr/EmptyMini";
import { Pagination } from "@/components/qr/Pagination";
import { formatRelative } from "@/lib/format-relative";
import { MAX_QR_CODES } from "@/lib/qr-workspace";
import type { Period, QRRecord, ScanRecord } from "@/components/qr/types";

const RECENT_SCANS_PAGE_SIZE = 10;

interface OverviewViewProps {
  records: QRRecord[];
  scans: ScanRecord[];
  period: Period;
  setPeriod: (period: Period) => void;
  onViewCodes: () => void;
  onCreateCode: () => void;
}

export function OverviewView({
  records,
  scans,
  period,
  setPeriod,
  onViewCodes,
  onCreateCode,
}: OverviewViewProps) {
  const [recentScansPage, setRecentScansPage] = useState(1);
  const [isNarrowPhone, setIsNarrowPhone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 479px)");
    const update = () => setIsNarrowPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const codeNames = useMemo(() => new Map(records.map((code) => [code.id, code.name])), [records]);

  const filteredScans = useMemo(() => {
    const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
    return scans.filter((scan) => new Date(scan.scanned_at).getTime() >= cutoff);
  }, [period, scans]);

  const dailyScans = useMemo(() => {
    const result: { day: string; count: number }[] = [];
    for (let offset = period - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      const key = day.toLocaleDateString("en-CA");
      const count = filteredScans.filter(
        (scan) => new Date(scan.scanned_at).toLocaleDateString("en-CA") === key,
      ).length;
      result.push({
        day: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      });
    }
    return result;
  }, [filteredScans, period]);

  const devices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scan of filteredScans)
      counts.set(scan.device_type, (counts.get(scan.device_type) ?? 0) + 1);
    const total = filteredScans.length;
    return [
      {
        name: "Mobile",
        key: "mobile",
        count: counts.get("mobile") ?? 0,
        Icon: Smartphone,
        tone: "bg-primary/10 text-primary",
      },
      {
        name: "Desktop",
        key: "desktop",
        count: counts.get("desktop") ?? 0,
        Icon: Monitor,
        tone: "bg-chart-3/15 text-chart-3",
      },
      {
        name: "Tablet",
        key: "tablet",
        count: counts.get("tablet") ?? 0,
        Icon: Tablet,
        tone: "bg-chart-4/20 text-chart-4",
      },
    ].map((device) => ({
      ...device,
      percentage: total ? Math.round((device.count / total) * 100) : 0,
    }));
  }, [filteredScans]);

  const sourceData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scan of filteredScans) {
      const host = scan.referrer_host || "Direct / unknown";
      counts.set(host, (counts.get(host) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredScans]);

  const popularCodes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scan of filteredScans)
      counts.set(scan.qr_code_id, (counts.get(scan.qr_code_id) ?? 0) + 1);
    return records
      .map((code) => ({ ...code, scans: counts.get(code.id) ?? 0 }))
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 5);
  }, [filteredScans, records]);

  const totalScans = filteredScans.length;
  const activeCount = records.filter((code) => code.is_active).length;

  const recentScansTotalPages = Math.max(
    1,
    Math.ceil(filteredScans.length / RECENT_SCANS_PAGE_SIZE),
  );
  const safeRecentScansPage = Math.min(recentScansPage, recentScansTotalPages);
  const paginatedRecentScans = filteredScans.slice(
    (safeRecentScansPage - 1) * RECENT_SCANS_PAGE_SIZE,
    safeRecentScansPage * RECENT_SCANS_PAGE_SIZE,
  );

  const handlePeriodChange = (days: Period) => {
    setPeriod(days);
    setRecentScansPage(1);
  };

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="QR code summary">
        <StatCard
          label="Scans"
          value={totalScans.toLocaleString()}
          note={`Past ${period} days`}
          icon={<BarChart3 />}
          accent="green"
        />
        <StatCard
          label="Active codes"
          value={`${activeCount}`}
          note={`${records.length} of ${MAX_QR_CODES} created`}
          icon={<QrCode />}
          accent="mint"
        />
        <StatCard
          label="Mobile scans"
          value={`${devices.find((device) => device.key === "mobile")?.percentage ?? 0}%`}
          note={(() => {
            const c = devices.find((device) => device.key === "mobile")?.count ?? 0;
            return `${c} ${c === 1 ? "scan" : "scans"}`;
          })()}
          icon={<Smartphone />}
          accent="yellow"
        />
        <StatCard
          label="Top code"
          value={popularCodes[0]?.name ?? "—"}
          note={
            popularCodes[0]
              ? `${popularCodes[0].scans.toLocaleString()} ${popularCodes[0].scans === 1 ? "scan" : "scans"}`
              : "Create your first QR code"
          }
          icon={<Link2 />}
          accent="blue"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(270px,0.9fr)]">
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Scan activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Daily scans across all active links
              </p>
            </div>
            <div className="flex gap-1 rounded-md bg-muted p-1" aria-label="Scan date range">
              {([7, 30, 90] as const).map((days) => (
                <Button
                  key={days}
                  variant={period === days ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 min-w-11 px-2.5 text-xs sm:h-7 sm:min-w-10 sm:px-2"
                  onClick={() => handlePeriodChange(days)}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </div>
          <div
            className="mt-5 h-[200px] min-w-0 sm:h-[225px]"
            role="img"
            aria-label={`QR scans in the past ${period} days`}
          >
            <ResponsiveContainer width="100%" height={isNarrowPhone ? 200 : 225} minWidth={1}>
              <LineChart data={dailyScans} margin={{ top: 8, right: 10, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                  interval={period === 7 ? 0 : period === 30 ? 4 : 13}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Scans"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: "var(--primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Devices</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Where scans came from · {period} days
          </p>
          <div className="mt-5 space-y-4">
            {devices.map(({ name, count, percentage, Icon, tone }) => (
              <div key={name}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${tone}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm">{name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {percentage}%{" "}
                    <span className="text-xs font-normal text-muted-foreground">({count})</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {!totalScans && (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Device breakdown will appear after your first scan.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Top performing</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Your most scanned codes · {period} days
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2.5 text-xs sm:h-8"
              onClick={onViewCodes}
            >
              All codes <ExternalLink />
            </Button>
          </div>
          {popularCodes.some((entry) => entry.scans > 0) ? (
            <div className="mt-4 h-[180px]">
              <ResponsiveContainer width="100%" height={180} minWidth={1}>
                <BarChart
                  data={popularCodes}
                  layout="vertical"
                  margin={{ left: 2, right: 12, top: 3, bottom: 3 }}
                >
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isNarrowPhone ? 96 : 120}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="scans"
                    name="Scans"
                    fill="var(--chart-2)"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    isAnimationActive={false}
                  >
                    {popularCodes.map((entry, index) => (
                      <Cell key={entry.id} fill={`var(--chart-${(index % 4) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : popularCodes.length ? (
            <div className="mt-3 divide-y divide-border">
              {popularCodes.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                  <span className="text-sm font-medium tabular-nums">0</span>
                  <span className="text-xs text-muted-foreground">scans</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyMini
              title="No QR codes yet"
              description="Create a code to start tracking scans."
              action={onCreateCode}
            />
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Scan sources</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Referring websites · {period} days
              </p>
            </div>
            <Globe2 className="size-4 text-muted-foreground" />
          </div>
          {sourceData.length ? (
            <div className="mt-3 divide-y divide-border">
              {sourceData.map(([source, count], index) => (
                <div key={source} className="flex items-center gap-3 py-3">
                  <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{source}</span>
                  <span className="text-sm font-medium tabular-nums">{count.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">
                    {count === 1 ? "scan" : "scans"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
              Scan sources will appear as visitors scan your codes.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Recent scans</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The latest activity from your QR codes
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{filteredScans.length} total scans</span>
        </div>
        {filteredScans.length ? (
          <>
            <div className="mt-4 divide-y divide-border sm:hidden">
              {paginatedRecentScans.map((scan, index) => (
                <div
                  key={`${scan.qr_code_id}-${scan.scanned_at}-${index}`}
                  className="py-3 first:pt-1 last:pb-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium leading-snug text-foreground">
                      {codeNames.get(scan.qr_code_id) ?? "QR code"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(scan.scanned_at)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-medium capitalize text-foreground">
                      {scan.device_type === "tablet" ? (
                        <Tablet className="size-3" aria-hidden="true" />
                      ) : scan.device_type === "desktop" ? (
                        <Monitor className="size-3" aria-hidden="true" />
                      ) : (
                        <Smartphone className="size-3" aria-hidden="true" />
                      )}
                      {scan.device_type || "unknown"}
                    </span>
                    <span className="min-w-0 truncate">
                      {scan.referrer_host || "Direct / unknown"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">QR code</th>
                    <th className="pb-2 font-medium">Device</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecentScans.map((scan, index) => (
                    <tr
                      key={`${scan.qr_code_id}-${scan.scanned_at}-${index}`}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="max-w-[200px] truncate py-3 pr-3 font-medium">
                        {codeNames.get(scan.qr_code_id) ?? "QR code"}
                      </td>
                      <td className="py-3 capitalize text-muted-foreground">
                        {scan.device_type || "unknown"}
                      </td>
                      <td className="max-w-[170px] truncate py-3 text-muted-foreground">
                        {scan.referrer_host || "Direct / unknown"}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right text-xs text-muted-foreground">
                        {formatRelative(scan.scanned_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={safeRecentScansPage}
              totalPages={recentScansTotalPages}
              onPageChange={setRecentScansPage}
              totalItems={filteredScans.length}
              pageSize={RECENT_SCANS_PAGE_SIZE}
            />
          </>
        ) : (
          <div className="flex min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
            Your recent scans will appear here.
          </div>
        )}
      </section>
    </>
  );
}
