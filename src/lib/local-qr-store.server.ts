import {
  canCreateQrCode,
  isUnlinkedDestination,
  MAX_QR_CODES,
  type StorageMode,
} from "@/lib/qr-workspace";

export interface StoredQrCode {
  id: string;
  code: string;
  name: string;
  destination_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoredQrScan {
  qr_code_id: string;
  scanned_at: string;
  device_type: string;
  referrer_host: string | null;
}

export type ResolveScanResult =
  | { status: "redirect"; destinationUrl: string; name: string }
  | { status: "paused"; name: string; code: string }
  | { status: "not_found" };

interface WorkspaceStoreData {
  codes: StoredQrCode[];
  scans: StoredQrScan[];
}

const DEFAULT_OWNER_ID = "00000000-0000-0000-0000-000000000000";

const GLOBAL_STORE_KEY = "__qrStudioWorkspaceStore";
const GLOBAL_STORE_MTIME_KEY = "__qrStudioWorkspaceStoreMtime";
const GLOBAL_WRITE_QUEUE_KEY = "__qrStudioWorkspaceWriteQueue";
const GLOBAL_PG_CLIENT_KEY = "__qrStudioPgClient";
const GLOBAL_PG_URL_KEY = "__qrStudioPgUrl";
const GLOBAL_PG_SCHEMA_KEY = "__qrStudioPgSchema";

type SqlTag = ReturnType<typeof import("postgres").default>;

const globalScope = globalThis as typeof globalThis & {
  [GLOBAL_STORE_KEY]?: WorkspaceStoreData;
  [GLOBAL_STORE_MTIME_KEY]?: number;
  [GLOBAL_WRITE_QUEUE_KEY]?: Promise<void>;
  [GLOBAL_PG_CLIENT_KEY]?: SqlTag;
  [GLOBAL_PG_URL_KEY]?: string;
  [GLOBAL_PG_SCHEMA_KEY]?: Promise<void>;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  return new Date().toISOString();
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getPostgresConnectionString(): string | null {
  if (process.env["VITEST"]) return null;
  const candidate =
    process.env["DATABASE_URL"]?.trim() ||
    process.env["POSTGRES_URL"]?.trim() ||
    process.env["POSTGRES_PRISMA_URL"]?.trim() ||
    "";
  return candidate.length > 0 ? candidate : null;
}

function getSupabaseCredentials(): { url: string; serviceKey: string } | null {
  if (process.env["VITEST"]) return null;
  const url = process.env["SUPABASE_URL"]?.trim() || "";
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() || "";
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

function isServerlessCloudRuntime(): boolean {
  if (process.env["VITEST"]) return false;
  return Boolean(
    process.env["VERCEL"] ||
    process.env["VERCEL_ENV"] ||
    process.env["AWS_LAMBDA_FUNCTION_NAME"] ||
    process.env["NETLIFY"] ||
    process.env["CF_PAGES"] ||
    process.env["CLOUDFLARE_WORKERS"],
  );
}

export function getStorageMode(): StorageMode {
  if (getPostgresConnectionString()) return "postgres";
  if (getSupabaseCredentials()) return "supabase";
  if (isServerlessCloudRuntime()) return "unconfigured-serverless";
  return "local-file";
}

async function getPgClient(): Promise<SqlTag> {
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (globalScope[GLOBAL_PG_CLIENT_KEY] && globalScope[GLOBAL_PG_URL_KEY] === connectionString) {
    return globalScope[GLOBAL_PG_CLIENT_KEY];
  }

  const { default: postgres } = await import("postgres");
  let disableSsl = false;
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname.toLowerCase();
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    disableSsl =
      sslMode === "disable" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".internal");
  } catch {
    disableSsl = false;
  }

  const client = postgres(connectionString, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: disableSsl ? false : "require",
  });

  globalScope[GLOBAL_PG_CLIENT_KEY] = client;
  globalScope[GLOBAL_PG_URL_KEY] = connectionString;
  delete globalScope[GLOBAL_PG_SCHEMA_KEY];
  return client;
}

async function ensurePostgresSchema(sql: SqlTag): Promise<void> {
  if (!globalScope[GLOBAL_PG_SCHEMA_KEY]) {
    globalScope[GLOBAL_PG_SCHEMA_KEY] = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS public.qr_codes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
          code text NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{8,32}$'),
          name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
          destination_url text NOT NULL CHECK (destination_url ~* '^https?://'),
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS qr_codes_owner_created_idx
        ON public.qr_codes (owner_id, created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS public.qr_scans (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
          scanned_at timestamptz NOT NULL DEFAULT now(),
          device_type text NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
          referrer_host text
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS qr_scans_code_time_idx
        ON public.qr_scans (qr_code_id, scanned_at DESC)
      `;
    })().catch((err) => {
      delete globalScope[GLOBAL_PG_SCHEMA_KEY];
      throw err;
    });
  }
  await globalScope[GLOBAL_PG_SCHEMA_KEY];
}

async function getFsHelpers() {
  if (process.env["VITEST"] || isServerlessCloudRuntime()) return null;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dataDir = path.join(process.cwd(), ".data");
    const dataFile = path.join(dataDir, "qr-workspace.json");
    return { fs, dataDir, dataFile };
  } catch {
    return null;
  }
}

async function getLanHost(): Promise<string | null> {
  if (process.env["VITEST"] || isServerlessCloudRuntime()) return null;
  try {
    const os = await import("node:os");
    const interfaces = os.networkInterfaces();
    const candidates: { address: string; priority: number }[] = [];
    for (const [name, entries] of Object.entries(interfaces)) {
      const isVirtual = /virtual|vmware|vbox|vethernet|wsl|hyper-v|docker|loopback|tun|tap/i.test(
        name,
      );
      const isWifi = /wi-fi|wifi|wlan/i.test(name);
      const isEthernet = /en0|eth0|ethernet/i.test(name);
      for (const info of entries ?? []) {
        if (info.family === "IPv4" && !info.internal && info.address) {
          const isVboxSubnet = info.address.startsWith("192.168.56.");
          const isPrivate =
            info.address.startsWith("192.168.") ||
            info.address.startsWith("10.") ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(info.address);
          let priority = 0;
          if (!isVirtual && !isVboxSubnet) priority += 10;
          if (isWifi) priority += 8;
          else if (isEthernet) priority += 4;
          if (isPrivate) priority += 2;
          candidates.push({ address: info.address, priority });
        }
      }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0]?.address ?? null;
  } catch {
    return null;
  }
}

async function readLocalStore(): Promise<WorkspaceStoreData> {
  const fsHelpers = await getFsHelpers();
  if (fsHelpers) {
    try {
      const stat = await fsHelpers.fs.stat(fsHelpers.dataFile);
      if (globalScope[GLOBAL_STORE_KEY] && globalScope[GLOBAL_STORE_MTIME_KEY] === stat.mtimeMs) {
        return globalScope[GLOBAL_STORE_KEY];
      }
      const raw = await fsHelpers.fs.readFile(fsHelpers.dataFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<WorkspaceStoreData>;
      const loaded: WorkspaceStoreData = {
        codes: Array.isArray(parsed.codes) ? parsed.codes : [],
        scans: Array.isArray(parsed.scans) ? parsed.scans : [],
      };
      globalScope[GLOBAL_STORE_KEY] = loaded;
      globalScope[GLOBAL_STORE_MTIME_KEY] = stat.mtimeMs;
      return loaded;
    } catch {
      // File does not exist yet or cannot be read; fall through
    }
  }

  if (globalScope[GLOBAL_STORE_KEY]) {
    return globalScope[GLOBAL_STORE_KEY];
  }

  const empty: WorkspaceStoreData = { codes: [], scans: [] };
  globalScope[GLOBAL_STORE_KEY] = empty;
  return empty;
}

async function persistLocalStore(store: WorkspaceStoreData): Promise<void> {
  globalScope[GLOBAL_STORE_KEY] = store;
  const fsHelpers = await getFsHelpers();
  if (!fsHelpers) return;

  const previous = globalScope[GLOBAL_WRITE_QUEUE_KEY] ?? Promise.resolve();
  const nextWrite = previous
    .catch(() => undefined)
    .then(async () => {
      await fsHelpers.fs.mkdir(fsHelpers.dataDir, { recursive: true });
      await fsHelpers.fs.writeFile(fsHelpers.dataFile, JSON.stringify(store, null, 2), "utf8");
      const stat = await fsHelpers.fs.stat(fsHelpers.dataFile);
      globalScope[GLOBAL_STORE_MTIME_KEY] = stat.mtimeMs;
    });
  globalScope[GLOBAL_WRITE_QUEUE_KEY] = nextWrite;
  await nextWrite;
}

function generateShortCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapPgCodeRow(row: Record<string, unknown>): StoredQrCode {
  return {
    id: String(row["id"]),
    code: String(row["code"]),
    name: String(row["name"]),
    destination_url: String(row["destination_url"]),
    is_active: Boolean(row["is_active"]),
    created_at: toIsoString(row["created_at"]),
    updated_at: toIsoString(row["updated_at"]),
  };
}

function mapPgScanRow(row: Record<string, unknown>): StoredQrScan {
  return {
    qr_code_id: String(row["qr_code_id"]),
    scanned_at: toIsoString(row["scanned_at"]),
    device_type: String(row["device_type"] ?? "unknown"),
    referrer_host: row["referrer_host"] ? String(row["referrer_host"]) : null,
  };
}

export async function listQrWorkspace() {
  const storageMode = getStorageMode();
  const networkHost = await getLanHost();
  const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  if (storageMode === "unconfigured-serverless") {
    return {
      codes: [] as StoredQrCode[],
      analytics: [] as {
        device_count: number;
        device_type: string;
        latest_scan: string;
        qr_code_id: string;
        scan_day: string;
        total_scans: number;
      }[],
      scans: [] as StoredQrScan[],
      networkHost: null,
      storageMode,
    };
  }

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const codeRows = await sql`
      SELECT id, code, name, destination_url, is_active, created_at, updated_at
      FROM public.qr_codes
      ORDER BY created_at DESC
    `;
    const scanRows = await sql`
      SELECT qr_code_id, scanned_at, device_type, referrer_host
      FROM public.qr_scans
      WHERE scanned_at >= ${cutoffIso}::timestamptz
      ORDER BY scanned_at DESC
      LIMIT 5000
    `;
    return {
      codes: codeRows.map((row) => mapPgCodeRow(row)),
      analytics: [] as {
        device_count: number;
        device_type: string;
        latest_scan: string;
        qr_code_id: string;
        scan_day: string;
        total_scans: number;
      }[],
      scans: scanRows.map((row) => mapPgScanRow(row)),
      networkHost,
      storageMode,
    };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [codesRes, scansRes] = await Promise.all([
      supabaseAdmin
        .from("qr_codes")
        .select("id, code, name, destination_url, is_active, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("qr_scans")
        .select("qr_code_id, scanned_at, device_type, referrer_host")
        .gte("scanned_at", cutoffIso)
        .order("scanned_at", { ascending: false })
        .limit(5000),
    ]);
    if (codesRes.error) throw new Error(codesRes.error.message);
    if (scansRes.error) throw new Error(scansRes.error.message);
    return {
      codes: (codesRes.data ?? []) as StoredQrCode[],
      analytics: [] as {
        device_count: number;
        device_type: string;
        latest_scan: string;
        qr_code_id: string;
        scan_day: string;
        total_scans: number;
      }[],
      scans: (scansRes.data ?? []) as StoredQrScan[],
      networkHost,
      storageMode,
    };
  }

  const store = await readLocalStore();
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const codes = [...store.codes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const scans = store.scans
    .filter((scan) => new Date(scan.scanned_at).getTime() >= cutoff)
    .sort((a, b) => b.scanned_at.localeCompare(a.scanned_at))
    .slice(0, 5000);

  return {
    codes,
    analytics: [] as {
      device_count: number;
      device_type: string;
      latest_scan: string;
      qr_code_id: string;
      scan_day: string;
      total_scans: number;
    }[],
    scans,
    networkHost,
    storageMode,
  };
}

function assertWritableStorage(storageMode: StorageMode) {
  if (storageMode === "unconfigured-serverless") {
    throw new Error(
      "Database not configured. Add DATABASE_URL in Vercel Environment Variables before creating QR codes.",
    );
  }
}

export async function createLocalQrCode(
  name: string,
  destinationUrl: string,
  isActive = !isUnlinkedDestination(destinationUrl),
) {
  const storageMode = getStorageMode();
  assertWritableStorage(storageMode);

  const now = new Date().toISOString();

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const countRows = await sql`SELECT count(*)::int AS count FROM public.qr_codes`;
    const count = Number(countRows[0]?.["count"] ?? 0);
    if (!canCreateQrCode(count)) {
      throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
    }
    const id = crypto.randomUUID();
    const code = generateShortCode();
    await sql`
      INSERT INTO public.qr_codes (id, owner_id, code, name, destination_url, is_active, created_at, updated_at)
      VALUES (${id}::uuid, ${DEFAULT_OWNER_ID}::uuid, ${code}, ${name}, ${destinationUrl}, ${isActive}, ${now}::timestamptz, ${now}::timestamptz)
    `;
    return { ok: true, id, code };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("qr_codes")
      .select("id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);
    if (!canCreateQrCode(count ?? 0)) {
      throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
    }
    const id = crypto.randomUUID();
    const code = generateShortCode();
    const { error } = await supabaseAdmin.from("qr_codes").insert({
      id,
      owner_id: DEFAULT_OWNER_ID,
      code,
      name,
      destination_url: destinationUrl,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    return { ok: true, id, code };
  }

  const store = await readLocalStore();
  if (!canCreateQrCode(store.codes.length)) {
    throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
  }

  let code = generateShortCode();
  while (store.codes.some((existing) => existing.code === code)) {
    code = generateShortCode();
  }

  const record: StoredQrCode = {
    id: crypto.randomUUID(),
    code,
    name,
    destination_url: destinationUrl,
    is_active: isActive,
    created_at: now,
    updated_at: now,
  };

  store.codes.unshift(record);
  await persistLocalStore(store);
  return { ok: true, id: record.id, code: record.code };
}

export async function batchCreateLocalQrCodes(
  prefix: string,
  count: number,
  destinationUrl: string,
  isActive: boolean,
) {
  const storageMode = getStorageMode();
  assertWritableStorage(storageMode);

  if (count < 1 || count > 50) {
    throw new Error("Create between 1 and 50 cards per batch.");
  }
  if (isActive && isUnlinkedDestination(destinationUrl)) {
    throw new Error("Blank inventory cards must start unlinked until a customer link is set.");
  }

  const padWidth = count >= 100 ? 3 : 2;
  const buildCardName = (index: number) =>
    count === 1 ? prefix : `${prefix} #${String(index + 1).padStart(padWidth, "0")}`.slice(0, 100);

  const baseTime = Date.now();

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const createdIds: string[] = [];
    await sql.begin(async (tx) => {
      const countRows = await tx`SELECT count(*)::int AS count FROM public.qr_codes`;
      const existingCount = Number(countRows[0]?.["count"] ?? 0);
      if (!canCreateQrCode(existingCount, count)) {
        throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
      }
      for (let i = 0; i < count; i++) {
        const id = crypto.randomUUID();
        const code = generateShortCode();
        const cardName = buildCardName(i);
        const ts = new Date(baseTime - i).toISOString();
        await tx`
          INSERT INTO public.qr_codes (id, owner_id, code, name, destination_url, is_active, created_at, updated_at)
          VALUES (${id}::uuid, ${DEFAULT_OWNER_ID}::uuid, ${code}, ${cardName}, ${destinationUrl}, ${isActive}, ${ts}::timestamptz, ${ts}::timestamptz)
        `;
        createdIds.push(id);
      }
    });
    return { ok: true, count, createdIds };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: existingCount, error: countErr } = await supabaseAdmin
      .from("qr_codes")
      .select("id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);
    if (!canCreateQrCode(existingCount ?? 0, count)) {
      throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
    }
    const rows = Array.from({ length: count }, (_, i) => {
      const ts = new Date(baseTime - i).toISOString();
      return {
        id: crypto.randomUUID(),
        owner_id: DEFAULT_OWNER_ID,
        code: generateShortCode(),
        name: buildCardName(i),
        destination_url: destinationUrl,
        is_active: isActive,
        created_at: ts,
        updated_at: ts,
      };
    });
    const { error } = await supabaseAdmin.from("qr_codes").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count, createdIds: rows.map((row) => row.id) };
  }

  const store = await readLocalStore();
  if (!canCreateQrCode(store.codes.length, count)) {
    throw new Error(`A workspace can have up to ${MAX_QR_CODES} QR codes.`);
  }

  const usedCodes = new Set(store.codes.map((item) => item.code));
  const created: StoredQrCode[] = [];
  for (let i = 0; i < count; i++) {
    let code = generateShortCode();
    while (usedCodes.has(code)) {
      code = generateShortCode();
    }
    usedCodes.add(code);
    const ts = new Date(baseTime - i).toISOString();
    created.push({
      id: crypto.randomUUID(),
      code,
      name: buildCardName(i),
      destination_url: destinationUrl,
      is_active: isActive,
      created_at: ts,
      updated_at: ts,
    });
  }

  store.codes = [...created, ...store.codes];
  await persistLocalStore(store);
  return { ok: true, count, createdIds: created.map((row) => row.id) };
}

export async function updateLocalQrCode(id: string, name: string, destinationUrl: string) {
  const storageMode = getStorageMode();
  assertWritableStorage(storageMode);

  const now = new Date().toISOString();
  const autoActivate = !isUnlinkedDestination(destinationUrl);

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const existing =
      await sql`SELECT is_active, destination_url FROM public.qr_codes WHERE id = ${id}::uuid LIMIT 1`;
    if (existing.length === 0) throw new Error("Could not find this QR code.");
    const nextActive =
      isUnlinkedDestination(String(existing[0]!["destination_url"])) && autoActivate
        ? true
        : isUnlinkedDestination(destinationUrl)
          ? false
          : Boolean(existing[0]!["is_active"]);

    await sql`
      UPDATE public.qr_codes
      SET name = ${name}, destination_url = ${destinationUrl}, is_active = ${nextActive}, updated_at = ${now}::timestamptz
      WHERE id = ${id}::uuid
    `;
    return { ok: true };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("qr_codes")
      .select("is_active, destination_url")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Could not find this QR code.");

    const nextActive =
      isUnlinkedDestination(existing.destination_url) && autoActivate
        ? true
        : isUnlinkedDestination(destinationUrl)
          ? false
          : existing.is_active;

    const { error } = await supabaseAdmin
      .from("qr_codes")
      .update({
        name,
        destination_url: destinationUrl,
        is_active: nextActive,
        updated_at: now,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  const store = await readLocalStore();
  const target = store.codes.find((item) => item.id === id);
  if (!target) {
    throw new Error("Could not find this QR code.");
  }

  const wasUnlinked = isUnlinkedDestination(target.destination_url);
  target.name = name;
  target.destination_url = destinationUrl;
  if (wasUnlinked && autoActivate) {
    target.is_active = true;
  } else if (isUnlinkedDestination(destinationUrl)) {
    target.is_active = false;
  }
  target.updated_at = now;
  await persistLocalStore(store);
  return { ok: true };
}

export async function toggleLocalQrCode(id: string) {
  const storageMode = getStorageMode();
  assertWritableStorage(storageMode);

  const now = new Date().toISOString();

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const rows = await sql`
      SELECT is_active, destination_url FROM public.qr_codes WHERE id = ${id}::uuid LIMIT 1
    `;
    if (rows.length === 0) throw new Error("Could not find this QR code.");
    const currentActive = Boolean(rows[0]!["is_active"]);
    const dest = String(rows[0]!["destination_url"]);
    if (!currentActive && isUnlinkedDestination(dest)) {
      throw new Error("Add the customer's Google Review link before activating this card.");
    }
    await sql`
      UPDATE public.qr_codes
      SET is_active = ${!currentActive}, updated_at = ${now}::timestamptz
      WHERE id = ${id}::uuid
    `;
    return { ok: true };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("qr_codes")
      .select("is_active, destination_url")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Could not find this QR code.");
    if (!existing.is_active && isUnlinkedDestination(existing.destination_url)) {
      throw new Error("Add the customer's Google Review link before activating this card.");
    }
    const { error } = await supabaseAdmin
      .from("qr_codes")
      .update({ is_active: !existing.is_active, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  const store = await readLocalStore();
  const target = store.codes.find((item) => item.id === id);
  if (!target) {
    throw new Error("Could not find this QR code.");
  }
  if (!target.is_active && isUnlinkedDestination(target.destination_url)) {
    throw new Error("Add the customer's Google Review link before activating this card.");
  }

  target.is_active = !target.is_active;
  target.updated_at = now;
  await persistLocalStore(store);
  return { ok: true };
}

export async function deleteLocalQrCode(id: string) {
  const storageMode = getStorageMode();
  assertWritableStorage(storageMode);

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const deleted = await sql`
      DELETE FROM public.qr_codes WHERE id = ${id}::uuid RETURNING id
    `;
    if (deleted.length === 0) throw new Error("Could not find this QR code.");
    return { ok: true };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("qr_codes").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Could not find this QR code.");
    return { ok: true };
  }

  const store = await readLocalStore();
  const index = store.codes.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Could not find this QR code.");
  }

  store.codes.splice(index, 1);
  store.scans = store.scans.filter((scan) => scan.qr_code_id !== id);
  await persistLocalStore(store);
  return { ok: true };
}

function normalizeScanMeta(deviceType: string, referrerHost: string | null) {
  const validDevice =
    deviceType === "mobile" || deviceType === "tablet" || deviceType === "desktop"
      ? deviceType
      : "unknown";
  const cleanReferrer = referrerHost
    ? referrerHost.replace(/[^A-Za-z0-9.-]/g, "").slice(0, 253) || null
    : null;
  return { validDevice, cleanReferrer };
}

export async function resolveLocalQrScanDetailed(
  code: string,
  deviceType: string,
  referrerHost: string | null,
): Promise<ResolveScanResult> {
  if (!code || !/^[A-Za-z0-9_-]{8,32}$/.test(code)) {
    return { status: "not_found" };
  }

  const storageMode = getStorageMode();
  const { validDevice, cleanReferrer } = normalizeScanMeta(deviceType, referrerHost);

  if (storageMode === "postgres") {
    const sql = await getPgClient();
    await ensurePostgresSchema(sql);
    const rows = await sql`
      SELECT id, code, name, destination_url, is_active
      FROM public.qr_codes
      WHERE code = ${code}
      LIMIT 1
    `;
    if (rows.length === 0) return { status: "not_found" };
    const row = rows[0]!;
    const destination = String(row["destination_url"]);
    if (!row["is_active"] || isUnlinkedDestination(destination) || !isSafeHttpUrl(destination)) {
      return { status: "paused", name: String(row["name"]), code: String(row["code"]) };
    }
    await sql`
      INSERT INTO public.qr_scans (qr_code_id, scanned_at, device_type, referrer_host)
      VALUES (${String(row["id"])}::uuid, now(), ${validDevice}, ${cleanReferrer})
    `;
    return { status: "redirect", destinationUrl: destination, name: String(row["name"]) };
  }

  if (storageMode === "supabase") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("qr_codes")
      .select("id, code, name, destination_url, is_active")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { status: "not_found" };
    if (
      !row.is_active ||
      isUnlinkedDestination(row.destination_url) ||
      !isSafeHttpUrl(row.destination_url)
    ) {
      return { status: "paused", name: row.name, code: row.code };
    }
    await supabaseAdmin.from("qr_scans").insert({
      qr_code_id: row.id,
      device_type: validDevice,
      referrer_host: cleanReferrer,
    });
    return { status: "redirect", destinationUrl: row.destination_url, name: row.name };
  }

  if (storageMode === "unconfigured-serverless") {
    return { status: "not_found" };
  }

  const store = await readLocalStore();
  const target = store.codes.find((item) => item.code === code);
  if (!target) {
    return { status: "not_found" };
  }
  if (
    !target.is_active ||
    isUnlinkedDestination(target.destination_url) ||
    !isSafeHttpUrl(target.destination_url)
  ) {
    return { status: "paused", name: target.name, code: target.code };
  }

  store.scans.unshift({
    qr_code_id: target.id,
    scanned_at: new Date().toISOString(),
    device_type: validDevice,
    referrer_host: cleanReferrer,
  });

  await persistLocalStore(store);
  return { status: "redirect", destinationUrl: target.destination_url, name: target.name };
}

export async function resolveLocalQrScan(
  code: string,
  deviceType: string,
  referrerHost: string | null,
): Promise<string | null> {
  const result = await resolveLocalQrScanDetailed(code, deviceType, referrerHost);
  return result.status === "redirect" ? result.destinationUrl : null;
}

export async function checkStorageHealth(): Promise<{
  ok: boolean;
  storageMode: StorageMode;
  codesCount: number;
  error?: string;
}> {
  const storageMode = getStorageMode();
  try {
    if (storageMode === "postgres") {
      const sql = await getPgClient();
      await ensurePostgresSchema(sql);
      const countRows = await sql`SELECT count(*)::int AS count FROM public.qr_codes`;
      return { ok: true, storageMode, codesCount: Number(countRows[0]?.["count"] ?? 0) };
    }
    if (storageMode === "supabase") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error } = await supabaseAdmin
        .from("qr_codes")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return { ok: true, storageMode, codesCount: count ?? 0 };
    }
    if (storageMode === "unconfigured-serverless") {
      return {
        ok: false,
        storageMode,
        codesCount: 0,
        error: "DATABASE_URL is not configured in serverless production.",
      };
    }
    const store = await readLocalStore();
    return { ok: true, storageMode, codesCount: store.codes.length };
  } catch (err) {
    return {
      ok: false,
      storageMode,
      codesCount: 0,
      error: err instanceof Error ? err.message : "Database health check failed.",
    };
  }
}
