import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const REPLIT_API_URL = import.meta.env.VITE_API_URL as string || "https://mono-vibe-maker.replit.app";

// Fire-and-forget: ships device logs to the Brain console for remote debugging.
// Visible in the Replit workspace under the Brain's console output.
export function drainLog(entries: string[], session = "mono-apk"): void {
  fetch(`${REPLIT_API_URL}/api/device-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries, session }),
  }).catch(() => { /* non-critical, never block UI on log drain */ });
}

export interface VibeTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
  uri?: string;
}

export interface LocalCommand {
  url: string;
  headers: Record<string, string>;
  body: string;
  description?: string;
}

export interface CurateResponse {
  vibe: string;
  reasoning: string;
  suggestions: Array<{ title: string; artist: string }>;
  tracks: VibeTrack[];
  localCommands: {
    play: LocalCommand;
    pause: LocalCommand;
    mute: LocalCommand;
    unmute: LocalCommand;
    loadFirstTrack: LocalCommand | null;
    loadFallbackPlaylist: LocalCommand;
  };
  fallback: { playlistId: string; playlistUri: string; note: string } | null;
  searchBlocked: boolean;
}

// Native-aware SOAP/UPnP executor — void return (fire and check status only).
// On Android: CapacitorHttp uses the OS network stack — bypasses CORS + WebView cleartext sandbox.
// On web/dev: falls back to standard fetch (no sandbox restrictions in browser).
async function executeLocalCommand(
  cmd: LocalCommand,
  label: string,
  onLog: (msg: string) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    ...cmd.headers,
    "Content-Type": 'text/xml; charset="utf-8"',
  };

  onLog(`${label} → ${cmd.description ?? cmd.url}`);

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      method: "POST",
      url: cmd.url,
      headers,
      data: cmd.body,
      responseType: "text",
    });
    const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    onLog(`${label} ← HTTP ${response.status}`);
    if (response.status < 200 || response.status >= 300) {
      onLog(`${label} REJECTED → ${body.slice(0, 500)}`);
      throw new Error(`Sonos rejected ${label}: HTTP ${response.status}`);
    }
  } else {
    const res = await fetch(cmd.url, {
      method: "POST",
      headers,
      body: cmd.body,
    });
    const body = await res.text();
    onLog(`${label} ← HTTP ${res.status} ${res.statusText}`);
    if (!res.ok) {
      onLog(`${label} REJECTED → ${body.slice(0, 500)}`);
      throw new Error(`Sonos rejected ${label}: HTTP ${res.status}`);
    }
  }
}

// SOAP executor that returns the full response body — used for diagnostic probes.
async function executeLocalCommandGetBody(
  cmd: LocalCommand,
  label: string,
  onLog: (msg: string) => void,
): Promise<string> {
  const headers: Record<string, string> = {
    ...cmd.headers,
    "Content-Type": 'text/xml; charset="utf-8"',
  };

  onLog(`${label} → ${cmd.description ?? cmd.url}`);

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      method: "POST",
      url: cmd.url,
      headers,
      data: cmd.body,
      responseType: "text",
    });
    const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    onLog(`${label} ← HTTP ${response.status}`);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${label} failed: HTTP ${response.status} — ${body.slice(0, 200)}`);
    }
    return body;
  } else {
    const res = await fetch(cmd.url, {
      method: "POST",
      headers,
      body: cmd.body,
    });
    const body = await res.text();
    onLog(`${label} ← HTTP ${res.status}`);
    if (!res.ok) throw new Error(`${label} failed: HTTP ${res.status}`);
    return body;
  }
}

// Transport controls: play, pause, mute, unmute
// Brain endpoint: POST /api/sonos/control → returns { localCommand }
export async function getCommand(
  action: "play" | "pause" | "mute" | "unmute",
  speakerIp: string,
): Promise<LocalCommand> {
  const res = await fetch(`${REPLIT_API_URL}/api/sonos/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, sonosIp: speakerIp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>)?.error as string ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { localCommand: LocalCommand };
  return data.localCommand;
}

// Volume control: POST /api/sonos/control with action=volume, then execute SOAP locally.
// NOTE: The Brain returns { localCommand } which must be executed from the device —
// the Brain is cloud-hosted and cannot reach the private LAN Sonos IP directly.
export async function sendVolumeControl(speakerIp: string, volume: number): Promise<void> {
  const res = await fetch(`${REPLIT_API_URL}/api/sonos/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "volume", sonosIp: speakerIp, volume: Math.max(0, Math.min(100, Math.round(volume))) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { localCommand?: LocalCommand };
  if (data.localCommand) {
    await executeLocalCommand(data.localCommand, "VOLUME", () => {});
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Builds a UPnP Stop command for the given speaker IP directly on the Face.
// Resets the Sonos transport to STOPPED state — must be sent before SetAVTransportURI
// to clear any error/transitioning state left from a previous failed or interrupted load.
function buildStopCmd(ip: string): LocalCommand {
  const AVT = "urn:schemas-upnp-org:service:AVTransport:1";
  return {
    url: `http://${ip}:1400/MediaRenderer/AVTransport/Control`,
    headers: {
      "SOAPACTION": `"${AVT}#Stop"`,
    },
    body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:Stop xmlns:u="${AVT}"><InstanceID>0</InstanceID></u:Stop></s:Body></s:Envelope>`,
    description: "Stop transport (clear state)",
  };
}

// Builds the ListAvailableServices probe command.
// MusicServices:1 service — returns all configured music services with their IDs.
function buildListServicesCmd(ip: string): LocalCommand {
  const SVC = "urn:schemas-sonos-com:service:MusicServices:1";
  return {
    url: `http://${ip}:1400/MusicServices/Control`,
    headers: {
      "SOAPACTION": `"${SVC}#ListAvailableServices"`,
    },
    body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:ListAvailableServices xmlns:u="${SVC}"></u:ListAvailableServices></s:Body></s:Envelope>`,
    description: "Probe: ListAvailableServices",
  };
}

// Builds a GetPositionInfo command — reads the current track URI from the transport.
// If the Sonos was last playing Spotify (e.g. from the native Sonos app), the TrackURI
// will contain the exact sn= value we need for SetAVTransportURI to succeed.
function buildGetPositionInfoCmd(ip: string): LocalCommand {
  const AVT = "urn:schemas-upnp-org:service:AVTransport:1";
  return {
    url: `http://${ip}:1400/MediaRenderer/AVTransport/Control`,
    headers: {
      "SOAPACTION": `"${AVT}#GetPositionInfo"`,
    },
    body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:GetPositionInfo xmlns:u="${AVT}"><InstanceID>0</InstanceID></u:GetPositionInfo></s:Body></s:Envelope>`,
    description: "Probe: GetPositionInfo (read current sn)",
  };
}

// Diagnostic probe: queries the Sonos device for all configured music services.
// Logs each service with its Id, Name, and Capabilities — critical for identifying
// the correct Spotify ServiceId and SA_RINCON string for this specific device.
// Full raw XML is drained to Brain console for offline analysis.
// Non-throwing — probe failures never block the main playback chain.
export async function probeServices(
  ip: string,
  onLog: (msg: string) => void,
): Promise<void> {
  const probeLogs: string[] = [];
  const plog = (msg: string) => { probeLogs.push(msg); onLog(msg); };

  try {
    const xml = await executeLocalCommandGetBody(buildListServicesCmd(ip), "PROBE", plog);

    // The Sonos response wraps all services inside <AvailableServiceDescriptorList>
    // as HTML-entity-encoded XML — must decode before parsing service blocks.
    const rawDescriptor = xml.match(/<AvailableServiceDescriptorList>([\s\S]*?)<\/AvailableServiceDescriptorList>/)?.[1] ?? "";
    const decoded = rawDescriptor
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Service attributes are on the tag (<Service Id="9" Name="Spotify" ...>)
    // not in child elements — match the opening tag and full block
    const serviceBlocks = decoded.match(/<Service[^/][\s\S]*?<\/Service>/g) ?? [];
    plog(`PROBE → ${serviceBlocks.length} services on device`);

    serviceBlocks.forEach((block) => {
      const id    = block.match(/\bId="([^"]+)"/)?.[1]                       ?? "?";
      const name  = block.match(/\bName="([^"]+)"/)?.[1]                     ?? "?";
      const caps  = block.match(/\bCapabilities="([^"]+)"/)?.[1]             ?? "?";
      const uri   = block.match(/\bSecureUri="([^"]+)"/)?.[1]               ??
                    block.match(/\bUri="([^"]+)"/)?.[1]                      ?? "?";

      plog(`  SVC id=${id} name="${name}" caps=${caps}`);

      // Flag Spotify by name or known service IDs (varies by region/firmware)
      const isSpotify = name.toLowerCase().includes("spotify") ||
                        ["9", "3079", "65031", "2311"].includes(id);
      if (isSpotify) {
        plog(`  *** SPOTIFY FOUND: id=${id} name="${name}" uri=${uri} ***`);
        localStorage.setItem("sonos_spotify_service_id", id);
      }
    });

    // If still 0 services, dump decoded content for manual inspection
    if (serviceBlocks.length === 0) {
      plog(`PROBE:DECODED_SNIPPET → ${decoded.slice(0, 400) || "(empty)"}`);
    }

    // Drain full raw XML to Brain console for offline analysis
    drainLog([`[PROBE:SERVICES_XML] ${xml.replace(/\s+/g, " ").slice(0, 4000)}`]);
  } catch (err) {
    plog(`PROBE FAILED → ${String(err)}`);
  }

  // Drain summary logs to Brain console
  drainLog(probeLogs.map((l) => `[PROBE] ${l}`));
}

// Reads the Sonos transport state before we STOP — if Spotify was loaded by the native
// Sonos app the TrackURI contains the exact sn= value. We parse and cache it so the
// LOAD command uses the right account serial on the very first attempt.
export async function probeTransportState(
  ip: string,
  onLog: (msg: string) => void,
): Promise<void> {
  const tLogs: string[] = [];
  const tlog = (msg: string) => { tLogs.push(msg); onLog(msg); };

  try {
    const xml = await executeLocalCommandGetBody(buildGetPositionInfoCmd(ip), "TRANSPORT", tlog);

    // ── TrackURI ─────────────────────────────────────────────────────────────
    const rawUri = xml.match(/<TrackURI>([^<]*)<\/TrackURI>/)?.[1] ?? "";
    const uri = rawUri
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    tlog(`TRANSPORT → URI: ${uri || "(empty)"}`);

    if (uri.includes("x-sonos-spotify")) {
      const snMatch = uri.match(/[?&]sn=(\d+)/);
      if (snMatch) {
        tlog(`TRANSPORT → sn=${snMatch[1]} captured — caching`);
        localStorage.setItem("sonos_spotify_sn", snMatch[1]);
      }
    }

    // ── TrackMetaData (entity-encoded DIDL-Lite) ─────────────────────────────
    // The Sonos embeds the DIDL XML as an entity-encoded string inside the SOAP.
    // Decode it to recover the raw DIDL, then extract the <desc> token —
    // this is the exact SA_RINCON... identity token we need to clone.
    const rawMeta = xml.match(/<TrackMetaData>([\s\S]*?)<\/TrackMetaData>/)?.[1] ?? "";
    const meta = rawMeta
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    if (meta) {
      tlog(`TRANSPORT → META (decoded): ${meta.replace(/\s+/g, " ").slice(0, 600)}`);

      // Extract every <desc> element — one of these holds the SA_RINCON token
      const descMatches = meta.matchAll(/<desc[^>]*>([\s\S]*?)<\/desc>/g);
      for (const m of descMatches) {
        const token = m[1].trim();
        tlog(`TRANSPORT → DESC TOKEN: "${token}"`);
        // Cache the token so the LOAD command can use it directly
        if (token.startsWith("SA_RINCON")) {
          localStorage.setItem("sonos_spotify_desc_token", token);
          tlog(`TRANSPORT → SA_RINCON token cached ✓`);
        }
      }

      // Also search for r:description or any other namespace variant
      const rDescMatches = meta.matchAll(/<r:description[^>]*>([\s\S]*?)<\/r:description>/g);
      for (const m of rDescMatches) {
        tlog(`TRANSPORT → r:DESCRIPTION: "${m[1].trim()}"`);
      }
    } else {
      tlog("TRANSPORT → META: (empty or not present)");
    }

    // Drain full raw SOAP response to Brain console for offline inspection
    drainLog([
      `[TRANSPORT:URI] ${uri}`,
      `[TRANSPORT:META] ${meta.replace(/\s+/g, " ").slice(0, 3000)}`,
    ]);
  } catch (err) {
    tlog(`TRANSPORT PROBE FAILED → ${String(err)}`);
  }

  drainLog(tLogs.map((l) => `[TRANSPORT] ${l}`));
}

// Full voice-to-music chain:
// 0. PROBE — ListAvailableServices diagnostic (non-blocking, results in Brain logs)
// 1. POST /api/curate → gets track list + localCommands SOAP payloads from Brain
// 2. STOP — resets Sonos transport to clean STOPPED state (fixes stuck-after-error gremlin)
// 3. LOAD — tries sn=1,2,3 in order; caches the working value in localStorage
//    so every subsequent call uses the right value immediately without retrying
// 4. PLAY — starts playback
export async function executeVibeChain(
  query: string,
  speakerIp: string,
  onLog: (msg: string) => void,
): Promise<void> {
  const chainLogs: string[] = [];
  const logAndCollect = (msg: string) => { chainLogs.push(msg); onLog(msg); };

  logAndCollect(`VIBE QUERY → "${query}" | speaker: ${speakerIp}`);

  // Step 0: Diagnostic probe — identifies all music services on device.
  // Runs every time so Brain drain logs always have fresh service data.
  // Never throws — probe failure never blocks playback.
  try {
    await probeServices(speakerIp, logAndCollect);
  } catch {
    logAndCollect("PROBE skipped");
  }

  const res = await fetch(`${REPLIT_API_URL}/api/curate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vibe: query, sonosIp: speakerIp }),
  });
  if (!res.ok) throw new Error(`Brain returned HTTP ${res.status}`);

  const data = await res.json() as CurateResponse;
  const tracks = data.tracks ?? [];
  logAndCollect(`TRACKS → ${tracks.length} verified`);
  tracks.slice(0, 2).forEach((t) => {
    const displayName = t.name ?? (t as unknown as Record<string, string>).title ?? "unknown";
    logAndCollect(`  ♪ ${displayName} — ${t.uri ?? ""}`);
  });

  if (data.fallback && tracks.length === 0) {
    logAndCollect(`FALLBACK → ${data.fallback.note}`);
  }

  const cmds = data.localCommands;
  if (!cmds) throw new Error("No localCommands in Brain response — check Brain logs");

  const baseLoadCmd = cmds.loadFirstTrack ?? cmds.loadFallbackPlaylist;

  // Step 0b: Read current transport state — captures Spotify sn before we STOP wipes it
  try {
    await probeTransportState(speakerIp, logAndCollect);
  } catch {
    logAndCollect("TRANSPORT PROBE skipped");
  }

  try {
    // Step 1: Stop — reset transport unconditionally before loading new content
    await executeLocalCommand(buildStopCmd(speakerIp), "STOP", logAndCollect);
    await sleep(300);

    // Step 2: Load — try sn values in order; cached winner is tried first
    // sn is the Sonos Spotify account serial assigned when Spotify was linked in the Sonos app
    const cachedSn = localStorage.getItem("sonos_spotify_sn");
    const snOrder = cachedSn
      ? [Number(cachedSn), ...[1,2,3,4,5,6,7,8,9,10,11,12].filter((n) => n !== Number(cachedSn))]
      : [1,2,3,4,5,6,7,8,9,10,11,12];

    let loadSuccess = false;
    for (const sn of snOrder) {
      // Patch LOAD body to match native Sonos app URI format exactly:
      // 1. URL-encode spotify colons: spotify:track:ID → spotify%3atrack%3aID (from GetPositionInfo capture)
      // 2. Use flags=8232 (native app value, not 8224)
      const patchedBody = baseLoadCmd.body
        .replace(/sn=\d+/g, `sn=${sn}`)
        .replace(/x-sonos-spotify:spotify:track:/g, "x-sonos-spotify:spotify%3atrack%3a")
        .replace(/flags=8224/g, "flags=8232");

      // Log the exact URI snippet being sent for verification
      const uriSnippet = patchedBody.match(/x-sonos-spotify[^"<& ]*/)?.[0]?.slice(0, 140) ?? "(uri not found in body)";
      logAndCollect(`  URI → ${uriSnippet}`);

      const patchedLoad: LocalCommand = {
        ...baseLoadCmd,
        body: patchedBody,
        description: `Load track (sn=${sn}, flags=8232)`,
      };
      try {
        await executeLocalCommand(patchedLoad, "LOAD", logAndCollect);
        localStorage.setItem("sonos_spotify_sn", String(sn));
        loadSuccess = true;
        break;
      } catch {
        logAndCollect(`  sn=${sn} rejected — trying next`);
      }
    }

    if (!loadSuccess) {
      throw new Error("Sonos rejected LOAD for sn=1..12 — check PROBE/TRANSPORT logs; Spotify may need re-linking in Sonos app");
    }

    // Step 3: Play
    await executeLocalCommand(cmds.play, "PLAY", logAndCollect);
    logAndCollect("PLAYBACK STARTED ✓");
  } finally {
    drainLog(chainLogs);
  }
}

// Legacy helper (used by SpotifyModule / TestVibeBridge)
export async function getCurateCommand(
  query: string,
  speakerIp: string,
): Promise<LocalCommand> {
  const res = await fetch(`${REPLIT_API_URL}/api/curate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vibe: query, sonosIp: speakerIp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>)?.error as string ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as CurateResponse;
  return data.localCommands?.loadFirstTrack ?? data.localCommands?.loadFallbackPlaylist;
}

export async function searchVibes(query: string): Promise<VibeTrack[]> {
  const res = await fetch(
    `${REPLIT_API_URL}/api/search?q=${encodeURIComponent(query)}`,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const items: unknown[] = data?.tracks ?? data?.results ?? data ?? [];

  return (items as Array<Record<string, unknown>>).map((t) => ({
    name: String(t.name ?? t.title ?? "Unknown"),
    artist: String(t.artist ?? t.artists ?? "Unknown"),
    album: String(t.album ?? ""),
    image: String(t.image ?? t.artwork ?? t.cover ?? ""),
    uri: t.uri ? String(t.uri) : undefined,
  }));
}

export async function getVibeMetadata(id: string): Promise<VibeTrack | null> {
  const res = await fetch(`${REPLIT_API_URL}/api/vibe/${encodeURIComponent(id)}`);

  if (!res.ok) return null;

  const t = (await res.json()) as Record<string, unknown>;
  return {
    name: String(t.name ?? t.title ?? "Unknown"),
    artist: String(t.artist ?? t.artists ?? "Unknown"),
    album: String(t.album ?? ""),
    image: String(t.image ?? t.artwork ?? t.cover ?? ""),
    uri: t.uri ? String(t.uri) : undefined,
  };
}

// Alias for SpotifyModule compatibility
export const curateVibe = getCurateCommand;
