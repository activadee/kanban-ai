import path from "node:path";
import { setAppReady } from "./app";
import type { ServerConfig } from "./env";

export type ResolvedMigrations =
    | { kind: "folder"; path: string }
    | { kind: "bundled" };

export async function resolveMigrations(
    config: ServerConfig,
    explicit?: string,
): Promise<ResolvedMigrations> {
    const requested = explicit ?? config.migrationsDir ?? "__bundled__";

    // Backwards compatibility: '__embedded__' from the old Drizzle-based API
    // is treated the same as the new '__bundled__' sentinel.
    if (requested === "__bundled__" || requested === "__embedded__") {
        return { kind: "bundled" };
    }

    if (requested) {
        return { kind: "folder", path: path.resolve(requested) };
    }

    return { kind: "bundled" };
}

export function markReady() {
    setAppReady(true);
}
