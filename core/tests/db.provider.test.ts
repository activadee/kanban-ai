import { beforeEach, describe, expect, it, vi } from "vitest";

describe("db/provider", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("throws when provider is not set", async () => {
        const provider = await import("../src/db/provider");
        expect(() => provider.getDb()).toThrowError(
            "[core:db] provider not set; call setDbProvider() in host",
        );
        await expect(provider.withTx(async () => "noop")).rejects.toThrowError(
            "[core:db] provider not set; call setDbProvider() in host",
        );
    });

    it("uses injected provider for db access and transactions", async () => {
        const provider = await import("../src/db/provider");
        const txSpy = vi.fn(async (fn: (tx: string) => Promise<number>) =>
            fn("tx-db"),
        );

        provider.setDbProvider({
            getDb: () => "db-instance",
            withTx: txSpy,
        });

        expect(provider.getDb()).toBe("db-instance");

        const result = await provider.withTx(async (tx) => {
            expect(tx).toBe("tx-db");
            return 7;
        });
        expect(result).toBe(7);
        expect(txSpy).toHaveBeenCalledTimes(1);

        expect(provider.resolveDb("custom-db")).toBe("custom-db");
        expect(provider.resolveDb()).toBe("db-instance");
    });
});
