import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BarChart3, LoaderCircle, QrCode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { AdminUnlockScreen } from "@/components/qr/AdminUnlockScreen";
import { BatchCreateDialog } from "@/components/qr/BatchCreateDialog";
import { CodesView } from "@/components/qr/CodesView";
import { DeleteConfirmDialog } from "@/components/qr/DeleteConfirmDialog";
import { Header } from "@/components/qr/Header";
import { OverviewView } from "@/components/qr/OverviewView";
import { PrintSheet } from "@/components/qr/PrintSheet";
import { QRCodeEditor } from "@/components/qr/QRCodeEditor";
import { QRPreviewDialog } from "@/components/qr/QRPreviewDialog";
import { Sidebar } from "@/components/qr/Sidebar";
import type { Period, QRRecord, View } from "@/components/qr/types";
import { Button } from "@/components/ui/button";
import {
  batchCreateQrCodes,
  createQrCode,
  deleteQrCode,
  getQrWorkspace,
  lockAdminWorkspace,
  toggleQrCode,
  unlockAdminWorkspace,
  updateQrCode,
} from "@/lib/qr-workspace.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QR Studio — Dynamic QR Workspace" },
      {
        name: "description",
        content: "Manage dynamic Google Review QR cards, print them, and see how customers scan.",
      },
      { property: "og:title", content: "QR Studio — Dynamic QR Workspace" },
      {
        property: "og:description",
        content: "Manage dynamic Google Review QR cards, print them, and see how customers scan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QRWorkspace,
});

const queryOptions = {
  queryKey: ["qr-workspace"],
  queryFn: () => getQrWorkspace(),
  staleTime: 5_000,
};

const CUSTOM_ORIGIN_KEY = "qrstudio_custom_origin";

function normalizeOriginInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function QRWorkspace() {
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState("");
  const [useLanOrigin, setUseLanOrigin] = useState(true);
  const [customOrigin, setCustomOrigin] = useState("");
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState<Period>(30);

  // Editor & batch modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QRRecord | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  // Preview & Scan modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCodeId, setPreviewCodeId] = useState<string | null>(null);

  // Print filter target
  const [printTargetIds, setPrintTargetIds] = useState<string | string[] | null>(null);

  // Delete confirmation modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<QRRecord | null>(null);

  // Server functions
  const readWorkspace = useServerFn(getQrWorkspace);
  const unlockWorkspaceFn = useServerFn(unlockAdminWorkspace);
  const lockWorkspaceFn = useServerFn(lockAdminWorkspace);
  const createCode = useServerFn(createQrCode);
  const batchCreateCodes = useServerFn(batchCreateQrCodes);
  const updateCode = useServerFn(updateQrCode);
  const toggleCode = useServerFn(toggleQrCode);
  const removeCode = useServerFn(deleteQrCode);

  const { data, isLoading, error, refetch } = useQuery({
    ...queryOptions,
    queryFn: () => readWorkspace(),
    retry: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
  }, [queryClient]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      try {
        const saved = window.localStorage.getItem(CUSTOM_ORIGIN_KEY);
        if (saved) {
          const valid = normalizeOriginInput(saved);
          if (valid) setCustomOrigin(valid);
        }
      } catch {
        // Ignore storage restriction errors
      }
    }
  }, []);

  const handleCustomOriginChange = useCallback((value: string) => {
    const normalized = normalizeOriginInput(value);
    setCustomOrigin(normalized);
    if (typeof window !== "undefined") {
      try {
        if (normalized) {
          window.localStorage.setItem(CUSTOM_ORIGIN_KEY, normalized);
        } else {
          window.localStorage.removeItem(CUSTOM_ORIGIN_KEY);
        }
      } catch {
        // Ignore storage restriction errors
      }
    }
  }, []);

  const records = data?.codes ?? [];
  const scans = data?.scans ?? [];
  const networkHost = data?.networkHost ?? null;
  const storageMode = data?.storageMode ?? "local-file";
  const authEnabled = data?.authEnabled ?? false;

  const lanOrigin = (() => {
    if (!origin || !networkHost) return null;
    try {
      const parsed = new URL(origin);
      if (
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1" &&
        parsed.hostname !== "[::1]" &&
        parsed.hostname !== "::1"
      ) {
        return null;
      }
      parsed.hostname = networkHost;
      return parsed.origin;
    } catch {
      return null;
    }
  })();

  const activeQrOrigin = customOrigin || (useLanOrigin && lanOrigin ? lanOrigin : origin);
  const previewCode = records.find((item) => item.id === previewCodeId) ?? null;

  const handleUnlock = async (passcode: string) => {
    await unlockWorkspaceFn({ data: { passcode } });
    await refresh();
    toast.success("Workspace unlocked");
  };

  const handleLock = async () => {
    await lockWorkspaceFn();
    await refresh();
  };

  const handleCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (code: QRRecord) => {
    setEditing(code);
    setEditorOpen(true);
  };

  const handlePreview = (code: QRRecord) => {
    setPreviewCodeId(code.id);
    setPreviewOpen(true);
  };

  const handleSubmit = async (name: string, destinationUrl: string, isActive?: boolean) => {
    if (editing) {
      await updateCode({ data: { id: editing.id, name, destinationUrl } });
      toast.success("QR code updated");
    } else {
      await createCode({ data: { name, destinationUrl, isActive } });
      toast.success("QR code created");
    }
    await refresh();
  };

  const handleBatchCreate = async (params: {
    prefix: string;
    count: number;
    destinationUrl: string;
    isActive: boolean;
  }): Promise<string[]> => {
    const result = await batchCreateCodes({ data: params });
    await refresh();
    setView("codes");
    toast.success(`Generated ${result.count} Google Review cards`);
    return result.createdIds;
  };

  const handleToggle = async (code: QRRecord) => {
    try {
      await toggleCode({ data: { id: code.id } });
      await refresh();
      toast.success(code.is_active ? "QR code paused" : "QR code activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change this QR code.");
    }
  };

  const handleDeleteRequest = (code: QRRecord) => {
    setCodeToDelete(code);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await removeCode({ data: { id } });
      await refresh();
      toast.success("QR code deleted permanently");
    } catch {
      toast.error("Could not delete this QR code.");
      throw new Error("Delete failed");
    }
  };

  const printLabel = (target?: QRRecord | string[]) => {
    if (!activeQrOrigin) return;
    const isSingle = Boolean(target && !Array.isArray(target));
    const nextTarget: string | string[] = Array.isArray(target)
      ? target
      : target
        ? target.id
        : "all";
    flushSync(() => {
      setPrintTargetIds(nextTarget);
    });
    document.body.dataset["printMode"] = isSingle ? "single" : "batch";
    window.print();
    delete document.body.dataset["printMode"];
    setPrintTargetIds(null);
  };

  if (data?.adminLocked) {
    return <AdminUnlockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="dashboard-app mx-auto min-h-screen max-w-[1500px] md:grid md:grid-cols-[216px_minmax(0,1fr)]">
        <Sidebar view={view} setView={setView} codesCount={records.length} />

        <div className="min-w-0">
          <Header
            view={view}
            codesCount={records.length}
            authEnabled={authEnabled}
            onPrintAll={() => printLabel()}
            onBatchCreate={() => setBatchOpen(true)}
            onCreateCode={handleCreate}
            onLockWorkspace={() => void handleLock()}
          />

          <main className="px-3.5 pb-10 pt-5 sm:px-8 sm:pb-12 sm:pt-8">
            {storageMode === "unconfigured-serverless" && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    Cloud Database Required Before Printing Customer Cards
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    This serverless deployment does not have a persistent database yet. Add{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                      DATABASE_URL
                    </code>{" "}
                    (for example, Neon Postgres or Supabase Postgres) in your Vercel Environment
                    Variables and redeploy so QR codes and scans persist permanently.
                  </p>
                </div>
              </div>
            )}

            {error ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5"
              >
                <p className="font-medium">Could not load your workspace.</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Check your connection and try again."}
                </p>
                <Button variant="outline" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-52 items-center justify-center">
                <LoaderCircle
                  className="size-6 animate-spin text-primary"
                  aria-label="Loading QR codes"
                />
              </div>
            ) : (
              <>
                <section className="mb-5 flex flex-col gap-3.5 sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">Your workspace</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
                      {view === "overview" ? "Overview" : "My QR codes"}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage dynamic Google Review cards, print labels, and track live scans.
                    </p>
                  </div>
                  <div
                    className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 sm:inline-flex sm:w-auto sm:shrink-0"
                    role="group"
                    aria-label="Choose dashboard view"
                  >
                    <Button
                      size="sm"
                      variant={view === "overview" ? "secondary" : "ghost"}
                      className="h-9 justify-center px-3 sm:h-8"
                      aria-pressed={view === "overview"}
                      onClick={() => setView("overview")}
                    >
                      <BarChart3 aria-hidden="true" />
                      <span>Overview</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={view === "codes" ? "secondary" : "ghost"}
                      className="h-9 justify-center px-3 sm:h-8"
                      aria-pressed={view === "codes"}
                      onClick={() => setView("codes")}
                    >
                      <QrCode aria-hidden="true" />
                      <span className="sm:hidden">Codes</span>
                      <span className="hidden sm:inline">QR codes</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums text-foreground">
                        {records.length}
                      </span>
                    </Button>
                  </div>
                </section>

                {view === "overview" ? (
                  <OverviewView
                    records={records}
                    scans={scans}
                    period={period}
                    setPeriod={setPeriod}
                    onViewCodes={() => setView("codes")}
                    onCreateCode={handleCreate}
                  />
                ) : (
                  <CodesView
                    records={records}
                    scans={scans}
                    origin={activeQrOrigin}
                    browserOrigin={origin}
                    lanOrigin={lanOrigin}
                    useLanOrigin={useLanOrigin}
                    onUseLanOriginChange={setUseLanOrigin}
                    customOrigin={customOrigin}
                    onCustomOriginChange={handleCustomOriginChange}
                    storageMode={storageMode}
                    onPreview={handlePreview}
                    onEdit={handleEdit}
                    onToggle={(code) => void handleToggle(code)}
                    onDelete={handleDeleteRequest}
                    onPrint={(code) => printLabel(code)}
                    onBatchCreate={() => setBatchOpen(true)}
                    onCreateCode={handleCreate}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <PrintSheet records={records} origin={activeQrOrigin} printTargetId={printTargetIds} />

      <QRPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        code={previewCode}
        origin={origin}
        lanOrigin={lanOrigin}
        useLanOrigin={useLanOrigin}
        onUseLanOriginChange={setUseLanOrigin}
        customOrigin={customOrigin}
        onTestedScan={() => void refresh()}
      />

      <QRCodeEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        codesCount={records.length}
        onSubmit={handleSubmit}
      />

      <BatchCreateDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        codesCount={records.length}
        activeOrigin={activeQrOrigin}
        onBatchCreate={handleBatchCreate}
        onPrintBatch={(ids) => printLabel(ids)}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        code={codeToDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
