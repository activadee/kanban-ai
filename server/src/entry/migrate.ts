import { loadConfig, setRuntimeConfig, type ServerConfig } from "../env";
import { createDbClient } from "../db/client";
import { bootstrapRuntime } from "../start";
import { applyLogConfig, log } from "../log";

const run = async () => {
  const baseConfig: ServerConfig = loadConfig();

  setRuntimeConfig(baseConfig);
  applyLogConfig(baseConfig);

  const dbResources = createDbClient(baseConfig);
  const migrationsDir = baseConfig.migrationsDir;

  const resolvedDir = await bootstrapRuntime(baseConfig, dbResources, migrationsDir);

  log.info("migrate", "completed Prisma migrations", {
    dbPath: dbResources.path,
    migrationsDir: resolvedDir,
  });
};

if (import.meta.main) {
  run().catch((error) => {
    log.error("migrate", "failed to apply migrations", { err: error });
    process.exit(1);
  });
}
