import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestProtocol,
  setCookie,
} from "@tanstack/react-start/server";

const ADMIN_COOKIE_NAME = "qrstudio_admin_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getPasscodeSecret(): string {
  if (process.env["VITEST"]) return "";
  return process.env["ADMIN_PASSCODE"]?.trim() || process.env["ADMIN_PASSWORD"]?.trim() || "";
}

function signTimestamp(expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
}

function hashValue(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isAdminAuthEnabled(): boolean {
  return getPasscodeSecret().length > 0;
}

export function isAdminSessionAuthorized(): boolean {
  const secret = getPasscodeSecret();
  if (!secret) return true;

  try {
    const rawCookie = getCookie(ADMIN_COOKIE_NAME);
    if (!rawCookie) return false;
    const dotIndex = rawCookie.indexOf(".");
    if (dotIndex <= 0) return false;

    const expiresStr = rawCookie.slice(0, dotIndex);
    const providedSig = rawCookie.slice(dotIndex + 1);
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

    const expectedSig = signTimestamp(expiresAt, secret);
    const a = Buffer.from(providedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function assertAdminAuthorized(): void {
  if (!isAdminSessionAuthorized()) {
    throw new Error("Workspace is locked. Enter your admin passcode to continue.");
  }
}

function isHttpsRequest(): boolean {
  try {
    const forwarded = getRequestHeader("x-forwarded-proto");
    if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
    return getRequestProtocol() === "https";
  } catch {
    return process.env["NODE_ENV"] === "production";
  }
}

export function verifyAndSetAdminSession(passcodeInput: string): boolean {
  const secret = getPasscodeSecret();
  if (!secret) return true;

  const candidateHash = hashValue(passcodeInput.trim());
  const expectedHash = hashValue(secret);
  if (!timingSafeEqual(candidateHash, expectedHash)) {
    return false;
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = `${expiresAt}.${signTimestamp(expiresAt, secret)}`;
  setCookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: isHttpsRequest(),
  });
  return true;
}

export function clearAdminSession(): void {
  try {
    deleteCookie(ADMIN_COOKIE_NAME, { path: "/" });
  } catch {
    // Ignore cookie clear errors outside request scope
  }
}
