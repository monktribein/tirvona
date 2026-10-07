const fs = require("fs");

module.exports = async () => {
  const embedded = globalThis.__TIRVONA_EMBEDDED_PG__;
  if (!embedded) return;
  await embedded.pg.stop();
  try {
    fs.rmSync(embedded.dir, { recursive: true, force: true });
  } catch {
    // Windows may keep the data directory locked briefly; the OS temp cleaner removes it.
  }
};
