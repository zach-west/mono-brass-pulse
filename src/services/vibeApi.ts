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

// Native-aware SOAP/UPnP executor.
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

// Volume control: POST /api/sonos/control with action=volume
export async function sendVolumeControl(speakerIp: string, volume: number): Promise<void> {
  const res = await fetch(`${REPLIT_API_URL}/api/sonos/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "volume", sonosIp: speakerIp, volume: Math.max(0, Math.min(100, Math.round(volume))) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// Full voice-to-music chain:
// 1. POST /api/curate → gets track list + localCommands SOAP payloads
// 2. Fire loadFirstTrack (or fallback playlist) directly to Sonos via native HTTP
// 3. Fire play command to start playback via native HTTP
// All log entries are drained to the Brain console for remote debugging.
export async function executeVibeChain(
  query: string,
  speakerIp: string,
  onLog: (msg: string) => void,
): Promise<void> {
  const chainLogs: string[] = [];
  const logAndCollect = (msg: string) => { chainLogs.push(msg); onLog(msg); };

  logAndCollect(`VIBE QUERY → "${query}" | speaker: ${speakerIp}`);

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
    logAndCollect(`  ♪ ${t.name} — ${t.uri ?? ""}`);
  });

  if (data.fallback && tracks.length === 0) {
    logAndCollect(`FALLBACK → ${data.fallback.note}`);
  }

  const cmds = data.localCommands;
  if (!cmds) throw new Error("No localCommands in Brain response — check Brain logs");

  const loadCmd = cmds.loadFirstTrack ?? cmds.loadFallbackPlaylist;
  try {
    await executeLocalCommand(loadCmd, "LOAD", logAndCollect);
    await executeLocalCommand(cmds.play, "PLAY", logAndCollect);
    logAndCollect("PLAYBACK STARTED ✓");
  } finally {
    drainLog(chainLogs);
  }
}

// Legacy helper (used by SpotifyModule / TestVibeBridge)
export async function curateVibe(
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
