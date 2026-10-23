import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { prisma } from "@direconnect/db";

/**
 * GET /api/keepalive
 *
 * Called daily by .github/workflows/keepalive.yml so that the free Supabase
 * project (database and Auth) and the free Redis database see real activity and
 * are not paused or archived for inactivity.
 *
 * Protected by a shared bearer token (KEEPALIVE_TOKEN); disabled with a 404 when
 * the token is not configured or, after trimming, shorter than 16 characters. Dependency errors are only ever logged on the
 * server, in a reduced form, and never returned to the caller.
 */

const REDIS_KEY = "keepalive:last";
const REDIS_KEY_TTL_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TOKEN_LENGTH = 16;

type CheckName = "database" | "redis" | "supabase";
type CheckResult = "ok" | "failed";

type RedisLike = {
  ping(): Promise<unknown>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
};

export type KeepaliveDeps = {
  db?: Pick<typeof prisma, "business">;
  getRedis?: () => Promise<RedisLike> | RedisLike;
  fetchImpl?: typeof fetch;
  token?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  timeoutMs?: number;
  now?: () => Date;
};

class CheckTimeoutError extends Error {
  constructor() {
    super("Check timed out");
    this.name = "CheckTimeoutError";
  }
}

class CheckFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckFailedError";
  }
}

/** Supabase Auth answered, but not with a 2xx status. Only the number is kept. */
class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Unexpected HTTP status");
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/**
 * Prisma, pg, ioredis and undici error messages can contain host names, ports,
 * user names or URLs, so only the error type and a short machine code are
 * logged. Messages and stacks are deliberately left out.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "non-Error value thrown";
  }

  const code = (error as { code?: unknown }).code;
  const safeCode =
    typeof code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(code)
      ? ` (${code})`
      : "";

  if (error instanceof HttpStatusError && Number.isInteger(error.status)) {
    return `${error.name} (HTTP ${error.status})`;
  }

  return `${error.name}${safeCode}`;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isValidToken(header: string | undefined, expected: string): boolean {
  const match = /^Bearer (.*)$/i.exec(header ?? "");
  const provided = match?.[1] ?? "";

  // Hashing first gives both buffers the same length for timingSafeEqual.
  return timingSafeEqual(sha256(provided), sha256(expected)) && match !== null;
}

async function withTimeout(
  run: (signal: AbortSignal) => Promise<void>,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CheckTimeoutError());
    }, timeoutMs);
  });

  try {
    await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function defaultGetRedis(): Promise<RedisLike> {
  // Loaded on first use so that importing this module never opens a Redis
  // connection (campaignQueue connects as soon as it is imported).
  const { campaignQueue } = await import("../lib/campaignQueue.js");

  return (await campaignQueue.client) as unknown as RedisLike;
}

export function createKeepaliveRouter(deps: KeepaliveDeps = {}) {
  const keepaliveRouter = Router();

  const db = deps.db ?? prisma;
  const getRedis = deps.getRedis ?? defaultGetRedis;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = deps.now ?? (() => new Date());

  keepaliveRouter.get("/", async (req, res) => {
    // Environment values are read per request so the endpoint follows the
    // process environment as it is at call time.
    const token = (deps.token ?? process.env.KEEPALIVE_TOKEN ?? "").trim();

    if (token.length < MIN_TOKEN_LENGTH) {
      return res.status(404).json({ error: "Not found" });
    }

    if (!isValidToken(req.header("authorization"), token)) {
      res.set("WWW-Authenticate", "Bearer");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabaseUrl = deps.supabaseUrl ?? process.env.SUPABASE_URL;
    const supabaseKey = deps.supabaseKey ?? process.env.SUPABASE_PUBLISHABLE_KEY;

    const checks: Record<CheckName, () => Promise<void>> = {
      database: () =>
        withTimeout(async () => {
          // A real row read (the result is ignored; an empty table is fine).
          await db.business.findFirst({ select: { id: true } });
        }, timeoutMs),

      redis: () =>
        withTimeout(async () => {
          const client = await getRedis();

          await client.ping();
          await client.set(
            REDIS_KEY,
            now().toISOString(),
            "EX",
            REDIS_KEY_TTL_SECONDS,
          );
        }, timeoutMs),

      supabase: () =>
        withTimeout(async (signal) => {
          if (!supabaseUrl || !supabaseKey) {
            throw new CheckFailedError("Supabase is not configured");
          }

          const response = await fetchImpl(
            `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/settings`,
            { headers: { apikey: supabaseKey }, signal },
          );

          // Release the connection; the body is not needed.
          void response.body?.cancel().catch(() => {});

          if (!response.ok) {
            throw new HttpStatusError(response.status);
          }
        }, timeoutMs),
    };

    const names = Object.keys(checks) as CheckName[];
    const settled = await Promise.allSettled(names.map((name) => checks[name]()));

    const results = {} as Record<CheckName, CheckResult>;

    names.forEach((name, index) => {
      const outcome = settled[index];

      if (outcome?.status === "fulfilled") {
        results[name] = "ok";
        return;
      }

      results[name] = "failed";
      console.error(
        "keepalive check failed",
        name,
        describeError(outcome?.status === "rejected" ? outcome.reason : undefined),
      );
    });

    const healthy = names.every((name) => results[name] === "ok");

    res.set("Cache-Control", "no-store");

    return res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      checks: results,
      timestamp: now().toISOString(),
    });
  });

  return keepaliveRouter;
}

export const keepaliveRouter = createKeepaliveRouter();
