import { describe, expect, it } from "vitest";

describe("settings/service - opencodePort", () => {
    it("uses default opencodePort of 4097", async () => {
        const { getAppSettingsSnapshot } = await import("../src/settings/service");
        const snapshot = getAppSettingsSnapshot();
        expect(snapshot.opencodePort).toBe(4097);
    });

    it("updateAppSettings updates opencodePort", async () => {
        const { updateAppSettings } = await import("../src/settings/service");
        const result = await updateAppSettings({ opencodePort: 5000 });
        expect(result.opencodePort).toBe(5000);
    });
});
