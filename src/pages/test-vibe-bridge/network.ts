export type BridgeErrorType = "cors" | "timeout" | "network" | "unknown";

export function classifyError(err: unknown): { type: BridgeErrorType; message: string } {
  if (err instanceof Error && err.message.includes("LAN target rejected")) {
    return {
      type: "network",
      message: "Invalid LAN target. Use a private IP (10.x / 172.16-31.x / 192.168.x / 169.254.x) on port 1400.",
    };
  }

  if (err instanceof Error && err.message.includes("Service Worker")) {
    return {
      type: "network",
      message: "Service Worker proxy inactive. Reload once after install, then retry.",
    };
  }

  if (err instanceof TypeError && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
    return {
      type: "cors",
      message:
        "Request blocked — likely CORS / Private Network Access restriction. Browser is rejecting private-network access.",
    };
  }

  if (err instanceof DOMException && err.name === "AbortError") {
    return { type: "timeout", message: "Request timed out — the device may be unreachable on this network." };
  }

  return { type: "unknown", message: String(err) };
}

export async function fetchViaLanProxy(target: string, init?: RequestInit, proxyMode: "cors" | "no-cors" = "cors") {
  const response = await fetch(`/__lan_proxy?target=${encodeURIComponent(target)}&proxyMode=${proxyMode}`, {
    ...init,
    cache: "no-store",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.clone().json().catch(() => null) : null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `LAN proxy failed (${response.status})`);
  }

  if (proxyMode === "cors" && response.headers.get("x-lan-proxy") !== "1") {
    throw new Error("Service Worker proxy header missing");
  }

  return response;
}
