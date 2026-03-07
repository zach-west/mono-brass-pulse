/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "X-LAN-Proxy": "1",
};

const isPrivateHost = (hostname: string) => {
  if (hostname === "localhost") return true;

  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 127
  );
};

const sanitizeTarget = (rawTarget: string | null) => {
  if (!rawTarget) return null;

  try {
    const parsed = new URL(rawTarget);

    if (parsed.protocol !== "http:") return null;
    if (!isPrivateHost(parsed.hostname)) return null;
    if (parsed.port && parsed.port !== "1400") return null;

    return parsed.toString();
  } catch {
    return null;
  }
};

const cloneHeaders = (incomingHeaders: Headers, useNoCors: boolean) => {
  if (useNoCors) {
    return {
      "Content-Type": "text/plain;charset=UTF-8",
    };
  }

  const forwardedHeaders: Record<string, string> = {};
  const contentType = incomingHeaders.get("content-type");
  const soapAction = incomingHeaders.get("soapaction");

  if (contentType) forwardedHeaders["Content-Type"] = contentType;
  if (soapAction) forwardedHeaders.SOAPACTION = soapAction;

  return forwardedHeaders;
};

const proxyRequest = async (request: Request, requestUrl: URL) => {
  const target = sanitizeTarget(requestUrl.searchParams.get("target"));
  const proxyMode = requestUrl.searchParams.get("proxyMode") === "no-cors" ? "no-cors" : "cors";

  if (!target) {
    return new Response(
      JSON.stringify({ error: "LAN target rejected. Use a private HTTP host on port 1400." }),
      { status: 403, headers: JSON_HEADERS }
    );
  }

  const method = request.method === "POST" ? "POST" : "GET";
  const useNoCors = proxyMode === "no-cors";

  try {
    const body = method === "POST" ? await request.clone().text() : undefined;
    const headers = cloneHeaders(request.headers, useNoCors);

    const response = await fetch(target, {
      method,
      mode: useNoCors ? "no-cors" : "cors",
      credentials: "omit",
      cache: "no-store",
      headers,
      body,
    });

    if (useNoCors) {
      return new Response(
        JSON.stringify({ ok: true, opaque: true, note: "no-cors send attempted" }),
        { status: 202, headers: JSON_HEADERS }
      );
    }

    const relayHeaders = new Headers(response.headers);
    relayHeaders.set("X-LAN-Proxy", "1");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: relayHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === "/~oauth") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname === "/__lan_proxy") {
    event.respondWith(proxyRequest(event.request, url));
  }
});
