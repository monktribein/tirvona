import type { Logger } from "@nestjs/common";

/**
 * Start-up housekeeping (idempotent seeds, data migrations, the first outbox
 * sweep) must not hold the HTTP port closed: every awaited query here adds a
 * database round trip to boot time. The task starts on the next tick, after
 * the lifecycle hook has returned, and a failure is logged instead of
 * aborting start-up.
 */
export function runAfterStartup(
  logger: Pick<Logger, "error">,
  name: string,
  task: () => Promise<unknown>,
): void {
  setTimeout(() => {
    task().catch((error: unknown) => {
      logger.error(
        `${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, 0);
}
