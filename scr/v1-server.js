
// ============================================
// SMASHERS — SERVER PATCHER
// ============================================

function getConfiguredV1Endpoint() {
    if (typeof window === "undefined") {
        return "";
    }

    const configured = window.SMASHERS_SERVER_CONFIG?.v1;

    return typeof configured === "string"
        ? configured.trim()
        : "";
}

function normalizeEndpoint(endpoint) {
    if (!endpoint) return "";

    let url;

    try {
        url = new URL(endpoint);
    } catch {
        throw new Error("Invalid server endpoint URL.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Server endpoints must use HTTP or HTTPS.");
    }

    if (url.username || url.password) {
        throw new Error(
            "Do not put credentials in a server endpoint URL."
        );
    }

    return url.href.replace(/\/+$/, "");
}

export class ServerPatcher {
    constructor(options = {}) {
        const {
            servers = null,
            timeoutMs = 4000,
            onStatus = () => {}
        } = options;

        const initialServers = servers || [
            {
                id: "v1",
                name: "Smashers Server V1",
                version: 1,
                baseUrl: getConfiguredV1Endpoint()
            }
        ];

        this.servers = new Map();
        this.timeoutMs = timeoutMs;
        this.onStatus = onStatus;

        this.activeServerId = null;

        this.status = {
            state: "idle",
            serverId: null,
            message: "Server patcher initialized."
        };

        for (const server of initialServers) {
            this.registerServer(server);
        }

        this.activeServerId =
            initialServers[0]?.id || null;
    }

    // ========================================
    // SERVER REGISTRY
    // ========================================

    registerServer(server) {
        if (
            !server ||
            typeof server.id !== "string" ||
            !server.id.trim()
        ) {
            throw new Error("A valid server ID is required.");
        }

        if (this.servers.has(server.id)) {
            throw new Error(
                `Server "${server.id}" is already registered.`
            );
        }

        const entry = {
            id: server.id,
            name: server.name || server.id,
            version: Number(server.version) || 1,
            baseUrl: normalizeEndpoint(server.baseUrl || "")
        };

        this.servers.set(entry.id, entry);

        return { ...entry };
    }

    listServers() {
        return Array.from(
            this.servers.values(),
            (server) => ({ ...server })
        );
    }

    getServer(serverId) {
        const server = this.servers.get(serverId);

        return server ? { ...server } : null;
    }

    get activeServer() {
        return this.getServer(this.activeServerId);
    }

    getStatus() {
        return { ...this.status };
    }

    // ========================================
    // SERVER CONFIGURATION
    // ========================================

    configureServer(serverId, endpoint) {
        const server = this.servers.get(serverId);

        if (!server) {
            throw new Error(
                `Unknown server: ${serverId}`
            );
        }

        server.baseUrl = normalizeEndpoint(endpoint);

        if (this.activeServerId === serverId) {
            this._emit(
                "configured",
                serverId,
                "Server endpoint configured."
            );
        }

        return this.getServer(serverId);
    }

    // ========================================
    // STATUS EVENTS
    // ========================================

    _emit(state, serverId, message, extra = {}) {
        this.status = {
            state,
            serverId,
            message,
            ...extra
        };

        try {
            this.onStatus(this.getStatus());
        } catch (error) {
            console.error(
                "Smashers server status callback failed:",
                error
            );
        }
    }

    // ========================================
    // CONNECT TO A SERVER
    // ========================================

    async connect(serverId = this.activeServerId) {
        const server = this.servers.get(serverId);

        if (!server) {
            const message = `Unknown server: ${serverId}`;

            this._emit(
                "error",
                serverId,
                message
            );

            return {
                connected: false,
                reason: "unknown-server",
                message
            };
        }

        if (!server.baseUrl) {
            const message =
                `${server.name} has no configured endpoint.`;

            this._emit(
                "unconfigured",
                serverId,
                message
            );

            return {
                connected: false,
                reason: "endpoint-not-configured",
                message
            };
        }

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, this.timeoutMs);

        this._emit(
            "connecting",
            serverId,
            `Connecting to ${server.name}...`
        );

        try {
            const baseUrl = `${server.baseUrl}/`;
            const healthUrl = new URL(
                "health",
                baseUrl
            );

            const response = await fetch(healthUrl, {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                signal: controller.signal,
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `Health check returned HTTP ${response.status}.`
                );
            }

            let data = null;

            try {
                data = await response.json();
            } catch {
                // A successful health response does not
                // have to contain JSON for this initial check.
            }

            this._emit(
                "connected",
                serverId,
                `Connected to ${server.name}.`,
                {
                    serverVersion: server.version,
                    serverResponse: data
                }
            );

            return {
                connected: true,
                serverId,
                data
            };
        } catch (error) {
            const message = error.name === "AbortError"
                ? `Connection to ${server.name} timed out.`
                : error.message;

            this._emit(
                "offline",
                serverId,
                message
            );

            return {
                connected: false,
                serverId,
                reason: error.name === "AbortError"
                    ? "timeout"
                    : "connection-failed",
                message
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    // ========================================
    // PATCH / SWITCH ACTIVE SERVER
    // ========================================

    async patch(serverId) {
        if (!this.servers.has(serverId)) {
            return {
                patched: false,
                reason: "unknown-server"
            };
        }

        const previousServerId = this.activeServerId;
        const target = this.servers.get(serverId);

        this._emit(
            "patching",
            serverId,
            `Switching to ${target.name}...`,
            {
                previousServerId
            }
        );

        const result = await this.connect(serverId);

        if (!result.connected) {
            this.activeServerId = previousServerId;

            this._emit(
                "patch-failed",
                serverId,
                "Server switch failed. Previous selection preserved.",
                {
                    previousServerId,
                    reason: result.reason
                }
            );

            return {
                patched: false,
                previousServerId,
                ...result
            };
        }

        this.activeServerId = serverId;

        this._emit(
            "connected",
            serverId,
            `Now using ${target.name}.`
        );

        return {
            patched: true,
            previousServerId,
            activeServerId: serverId
        };
    }

    // ========================================
    // SEND A REQUEST TO THE ACTIVE SERVER
    // ========================================

    async request(path, options = {}) {
        const server = this.servers.get(
            this.activeServerId
        );

        if (!server || !server.baseUrl) {
            throw new Error(
                "No configured active Smashers server."
            );
        }

        if (
            this.status.state !== "connected" ||
            this.status.serverId !== server.id
        ) {
            throw new Error(
                "The active Smashers server is not connected."
            );
        }

        if (
            typeof path !== "string" ||
            !path.trim() ||
            /^[a-z][a-z\d+.-]*:/i.test(path)
        ) {
            throw new Error(
                "Request path must be a relative server path."
            );
        }

        const relativePath = path.replace(/^\/+/, "");

        const url = new URL(
            relativePath,
            `${server.baseUrl}/`
        );

        const headers = new Headers(options.headers || {});

        if (!headers.has("Accept")) {
            headers.set("Accept", "application/json");
        }

        const response = await fetch(url, {
            ...options,
            headers,
            cache: "no-store"
        });

        const contentType =
            response.headers.get("content-type") || "";

        let data;

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            throw new Error(
                `Server request failed: HTTP ${response.status}.`
            );
        }

        return data;
    }

    // ========================================
    // DISCONNECT
    // ========================================

    disconnect() {
        this._emit(
            "disconnected",
            this.activeServerId,
            "Disconnected from the active server."
        );
    }
}
