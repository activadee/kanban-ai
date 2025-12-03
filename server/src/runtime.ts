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
    const requested = explicit ?? config.migrationsDir;
    if (requested && requested !== "__bundled__") {
        return { kind: "folder", path: path.resolve(requested) };
    }
    return { kind: "bundled" };
}

export function markReady() {
    setAppReady(true);
}
