/**
 * Provides a real Postgres 17 for the *.pg-spec.ts suites.
 * Uses PG_TEST_URL when set (CI service container); otherwise starts an
 * embedded Postgres 17 on a free port for the duration of the run.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

module.exports = async () => {
  if (process.env.PG_TEST_URL) return;
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tirvona-pg-"));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  globalThis.__TIRVONA_EMBEDDED_PG__ = { pg, dir };
  process.env.PG_TEST_URL = `postgres://postgres:postgres@localhost:${port}/postgres?sslmode=disable`;
};
