import { AsyncLocalStorage } from "node:async_hooks";
import { monitorEventLoopDelay } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";

/**
 * Opt-in request profiling (PERF_LOG=true). Per request it records wall time,
 * database query count and database time, and logs one JSON line when the
 * request is slower than PERF_LOG_MIN_MS. It also logs event-loop delay once a
 * minute: a high p99 means synchronous work is blocking every request.
 * Off by default; costs nothing when off.
 */
interface PerfStore {
  queries: number;
  dbMs: number;
}

const als = new AsyncLocalStorage<PerfStore>();

export const perfEnabled = (): boolean => process.env.PERF_LOG === "true";

/** Called by the pool wrapper around every query. */
export function recordQuery(ms: number): void {
  const store = als.getStore();
  if (!store) return;
  store.queries += 1;
  store.dbMs += ms;
}

export function requestPerfMiddleware() {
  const minMs = Number(process.env.PERF_LOG_MIN_MS ?? 150);
  return (req: Request, res: Response, next: NextFunction): void => {
    const store: PerfStore = { queries: 0, dbMs: 0 };
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (ms < minMs) return;
      const route = req.route?.path ? `${req.baseUrl}${String(req.route.path)}` : req.path;
      process.stdout.write(
        `${JSON.stringify({
          event: "perf.slow_request",
          method: req.method,
          route,
          status: res.statusCode,
          ms: Math.round(ms),
          dbMs: Math.round(store.dbMs),
          queries: store.queries,
          appMs: Math.round(ms - store.dbMs),
        })}\n`,
      );
    });
    als.run(store, next);
  };
}

export function startEventLoopMonitor(): void {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  setInterval(() => {
    const p99 = histogram.percentile(99) / 1e6;
    const max = histogram.max / 1e6;
    if (p99 >= 50 || max >= 250) {
      process.stdout.write(
        `${JSON.stringify({
          event: "perf.event_loop_lag",
          p50Ms: Math.round(histogram.percentile(50) / 1e6),
          p99Ms: Math.round(p99),
          maxMs: Math.round(max),
          rssMb: Math.round(process.memoryUsage().rss / 1048576),
        })}\n`,
      );
    }
    histogram.reset();
  }, 60_000).unref();
}

/**
 * Local-run request log: one short line per request ("GET /api/ashrams 200 45ms")
 * so a page visit is visible in the terminal. Used only outside production,
 * where pino-http already logs requests. Preflights and health checks are
 * skipped; REQUEST_LOG=false turns it off.
 */
export function devRequestLogMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === "OPTIONS" || req.path.startsWith("/api/health")) {
      next();
      return;
    }
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      const color = res.statusCode >= 500 ? "\x1b[31m" : res.statusCode >= 400 ? "\x1b[33m" : "\x1b[32m";
      process.stdout.write(`${req.method.padEnd(6)} ${req.originalUrl.split("?")[0]} ${color}${res.statusCode}\x1b[0m ${ms}ms\n`);
    });
    next();
  };
}
