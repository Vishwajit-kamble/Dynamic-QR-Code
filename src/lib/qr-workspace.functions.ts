import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UNLINKED_DESTINATION_URL } from "@/lib/qr-workspace";

const destinationSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an address starting with http:// or https://");

const codeSchema = z.string().uuid();
const codeInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  destinationUrl: destinationSchema,
  isActive: z.boolean().optional(),
});
const batchInputSchema = z.object({
  prefix: z.string().trim().min(1).max(80),
  count: z.number().int().min(1).max(50),
  destinationUrl: destinationSchema.default(UNLINKED_DESTINATION_URL),
  isActive: z.boolean().default(false),
});
const updateInputSchema = z.object({
  id: codeSchema,
  name: z.string().trim().min(1).max(100),
  destinationUrl: destinationSchema,
});
const idInputSchema = z.object({ id: codeSchema });
const passcodeInputSchema = z.object({
  passcode: z.string().min(1).max(200),
});

export const getQrWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const [auth, store] = await Promise.all([
    import("@/lib/admin-auth.server"),
    import("@/lib/local-qr-store.server"),
  ]);
  const authEnabled = auth.isAdminAuthEnabled();
  const authorized = auth.isAdminSessionAuthorized();

  if (!authorized) {
    return {
      adminLocked: true,
      authEnabled,
      codes: [] as Awaited<ReturnType<typeof store.listQrWorkspace>>["codes"],
      analytics: [] as Awaited<ReturnType<typeof store.listQrWorkspace>>["analytics"],
      scans: [] as Awaited<ReturnType<typeof store.listQrWorkspace>>["scans"],
      networkHost: null as string | null,
      storageMode: store.getStorageMode(),
      nextTrackingNumber: 1,
    };
  }

  const workspace = await store.listQrWorkspace();
  return {
    adminLocked: false,
    authEnabled,
    ...workspace,
  };
});

export const unlockAdminWorkspace = createServerFn({ method: "POST" })
  .validator((input: unknown) => passcodeInputSchema.parse(input))
  .handler(async ({ data }) => {
    const auth = await import("@/lib/admin-auth.server");
    const ok = auth.verifyAndSetAdminSession(data.passcode);
    if (!ok) {
      throw new Error("Incorrect admin passcode.");
    }
    return { ok: true };
  });

export const lockAdminWorkspace = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await import("@/lib/admin-auth.server");
  auth.clearAdminSession();
  return { ok: true };
});

export const createQrCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => codeInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [auth, store] = await Promise.all([
      import("@/lib/admin-auth.server"),
      import("@/lib/local-qr-store.server"),
    ]);
    auth.assertAdminAuthorized();
    return store.createLocalQrCode(data.name, data.destinationUrl, data.isActive);
  });

export const batchCreateQrCodes = createServerFn({ method: "POST" })
  .validator((input: unknown) => batchInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [auth, store] = await Promise.all([
      import("@/lib/admin-auth.server"),
      import("@/lib/local-qr-store.server"),
    ]);
    auth.assertAdminAuthorized();
    return store.batchCreateLocalQrCodes(
      data.prefix,
      data.count,
      data.destinationUrl,
      data.isActive,
    );
  });

export const updateQrCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [auth, store] = await Promise.all([
      import("@/lib/admin-auth.server"),
      import("@/lib/local-qr-store.server"),
    ]);
    auth.assertAdminAuthorized();
    return store.updateLocalQrCode(data.id, data.name, data.destinationUrl);
  });

export const toggleQrCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [auth, store] = await Promise.all([
      import("@/lib/admin-auth.server"),
      import("@/lib/local-qr-store.server"),
    ]);
    auth.assertAdminAuthorized();
    return store.toggleLocalQrCode(data.id);
  });

export const deleteQrCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [auth, store] = await Promise.all([
      import("@/lib/admin-auth.server"),
      import("@/lib/local-qr-store.server"),
    ]);
    auth.assertAdminAuthorized();
    return store.deleteLocalQrCode(data.id);
  });
