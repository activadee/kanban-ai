import http from "node:http";
import {randomUUID} from "node:crypto";
import type {AddressInfo} from "node:net";
import {EventEmitter} from "node:events";

type ShareCreateRequest = { sessionID: string };

type ShareCreateResponse = { url: string; secret: string };

export type ShareSyncRequest = {
    sessionID: string;
    secret: string;
    key: string;
    content: unknown;
};

export type ShareEvent = { type: "sync"; payload: ShareSyncRequest };

class ShareEmitter extends EventEmitter {
    emit(event: "event", payload: ShareEvent): boolean;
    emit(event: string, payload: ShareEvent) {
        return super.emit(event, payload);
    }

    on(event: "event", listener: (payload: ShareEvent) => void): this;
    on(event: string, listener: (payload: ShareEvent) => void) {
        return super.on(event, listener);
    }

    off(event: "event", listener: (payload: ShareEvent) => void): this;
    off(event: string, listener: (payload: ShareEvent) => void) {
        return super.off(event, listener);
    }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}

function jsonResponse(res: http.ServerResponse, status: number, payload: unknown) {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.setHeader("content-length", Buffer.byteLength(body));
    res.end(body);
}

type BridgeLogger = {
    debug?: (message: string) => void;
    error?: (message: string) => void;
};

export class ShareBridge {
    static async start(logger?: BridgeLogger): Promise<ShareBridge> {
        const secrets = new Map<string, string>();
        const emitter = new ShareEmitter();
        let bridgeRef: ShareBridge | null = null;

        const server = http.createServer(async (req, res) => {
            try {
                if (!req.url || req.method !== "POST") {
                    jsonResponse(res, 404, {});
                    return;
                }

                const url = new URL(req.url, "http://127.0.0.1");
                const rawBody = await readBody(req);
                const json = rawBody ? JSON.parse(rawBody) : {};

                switch (url.pathname) {
                    case "/share_create": {
                        const payload: ShareCreateRequest = {
                            sessionID: typeof json.sessionID === "string" ? json.sessionID : "",
                        };
                        const secret = randomUUID();
                        secrets.set(payload.sessionID, secret);
                        const baseUrl = bridgeRef?.baseUrl ?? "";
                        const resp: ShareCreateResponse = {
                            secret,
                            url: baseUrl ? `${baseUrl}/s/${shorten(payload.sessionID)}` : "",
                        };
                        jsonResponse(res, 200, resp);
                        return;
                    }
                    case "/share_delete": {
                        if (typeof json?.sessionID === "string") {
                            secrets.delete(json.sessionID);
                        }
                        jsonResponse(res, 200, {});
                        return;
                    }
                    case "/share_sync": {
                        const payload: ShareSyncRequest = {
                            sessionID: String(json?.sessionID ?? ""),
                            secret: String(json?.secret ?? ""),
                            key: String(json?.key ?? ""),
                            content: json?.content,
                        };
                        const expected = secrets.get(payload.sessionID);
                        if (!expected || expected !== payload.secret) {
                            if (logger?.debug) {
                                logger.debug(
                                    `[opencode:bridge] share_sync with invalid secret: ${payload.sessionID}`
                                );
                            } else {
                                console.debug(
                                    "[opencode:bridge] share_sync with invalid secret",
                                    payload.sessionID
                                );
                            }
                        }
                        emitter.emit("event", {type: "sync", payload});
                        jsonResponse(res, 200, {});
                        return;
                    }
                    default: {
                        jsonResponse(res, 404, {});
                        return;
                    }
                }
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                if (logger?.error) logger.error(`[opencode:bridge] handler error: ${message}`);
                else console.error("[opencode:bridge] handler error", error);
                jsonResponse(res, 500, {});
            }
        });

        const bridge = new ShareBridge(server, emitter, secrets);
        bridgeRef = bridge;
        await bridge.listen();
        return bridge;
    }

    private baseUrlValue = "";

    private constructor(
        private readonly server: http.Server,
        private readonly emitter: ShareEmitter,
        private readonly secrets: Map<string, string>
    ) {
    }

    get baseUrl() {
        return this.baseUrlValue;
    }

    private listen(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.once("error", reject);
            this.server.listen(0, "127.0.0.1", () => {
                this.server.off("error", reject);
                const address = this.server.address() as AddressInfo;
                this.baseUrlValue = `http://${address.address}:${address.port}`;
                resolve();
            });
        });
    }

    subscribe(listener: (event: ShareEvent) => void) {
        this.emitter.on("event", listener);
        return () => this.emitter.off("event", listener);
    }

    async shutdown() {
        await new Promise<void>((resolve) => {
            this.server.close(() => resolve());
        });
        this.secrets.clear();
    }
}

function shorten(id: string) {
    return id.slice(-8);
}
