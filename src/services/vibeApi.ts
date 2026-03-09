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

    // Extract individual <Service> blocks from the response
    const serviceBlocks = xml.match(/<Service>[\s\S]*?<\/Service>/g) ?? [];
    plog(`PROBE → ${serviceBlocks.length} services configured on device`);

    serviceBlocks.forEach((block) => {
      const name  = block.match(/<Name>([^<]+)<\/Name>/)?.[1]             ?? "?";
      const id    = block.match(/<Id>([^<]+)<\/Id>/)?.[1]                 ?? "?";
      const caps  = block.match(/<Capabilities>([^<]+)<\/Capabilities>/)?.[1] ?? "?";
      const uri   = block.match(/<SecureUri>([^<]+)<\/SecureUri>/)?.[1]   ??
                    block.match(/<Uri>([^<]+)<\/Uri>/)?.[1]                ?? "?";

      plog(`  SVC id=${id} name="${name}" caps=${caps}`);

      // Flag any Spotify-looking service — check by name and common IDs
      const isSpotify = name.toLowerCase().includes("spotify") ||
                        ["9", "3079", "65031", "2311"].includes(id);
      if (isSpotify) {
        plog(`  *** SPOTIFY CANDIDATE: id=${id} name="${name}" uri=${uri} ***`);
        // Cache for use in LOAD command
        localStorage.setItem("sonos_spotify_service_id", id);
      }
    });

    // Drain full raw XML to Brain console — strip whitespace to keep it one log line
    drainLog([`[PROBE:SERVICES_XML] ${xml.replace(/\s+/g, " ").slice(0, 4000)}`]);
  } catch (err) {
    plog(`PROBE FAILED → ${String(err)}`);
  }

  // Drain summary logs to Brain console
  drainLog(probeLogs.map((l) => `[PROBE] ${l}`));
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

  try {
    // Step 1: Stop — reset transport unconditionally before loading new content
    await executeLocalCommand(buildStopCmd(speakerIp), "STOP", logAndCollect);
    await sleep(300);

    // Step 2: Load — try sn values in order; cached winner is tried first
    // sn is the Sonos Spotify account serial assigned when Spotify was linked in the Sonos app
    const cachedSn = localStorage.getItem("sonos_spotify_sn");
    const snOrder = cachedSn
      ? [Number(cachedSn), ...[1, 2, 3].filter((n) => n !== Number(cachedSn))]
      : [1, 2, 3];

    let loadSuccess = false;
    for (const sn of snOrder) {
      const patchedLoad: LocalCommand = {
        ...baseLoadCmd,
        body: baseLoadCmd.body.replace(/sn=\d+/g, `sn=${sn}`),
        description: `Load track (sn=${sn})`,
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
      throw new Error("Sonos rejected LOAD for sn=1,2,3 — check PROBE logs above for service config");
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
