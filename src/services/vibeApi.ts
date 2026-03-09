export const REPLIT_API_URL = import.meta.env.VITE_API_URL as string || "https://mono-vibe-maker.replit.app";

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
// 2. Fire loadFirstTrack (or fallback playlist) directly to Sonos
// 3. Fire play command to start playback
export async function executeVibeChain(
  query: string,
  speakerIp: string,
  onLog: (msg: string) => void,
): Promise<void> {
  onLog(`VIBE QUERY → "${query}"`);

  const res = await fetch(`${REPLIT_API_URL}/api/curate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vibe: query, sonosIp: speakerIp }),
  });
  if (!res.ok) throw new Error(`Brain returned HTTP ${res.status}`);

  const data = await res.json() as CurateResponse;
  const tracks = data.tracks ?? [];
  onLog(`TRACKS → ${tracks.length} verified`);
  tracks.slice(0, 2).forEach((t) => {
    onLog(`  ♪ ${t.name} — ${t.uri ?? ""}`);
  });

  if (data.fallback && tracks.length === 0) {
    onLog(`FALLBACK → ${data.fallback.note}`);
  }

  const cmds = data.localCommands;
  if (!cmds) throw new Error("No localCommands in Brain response — check Brain logs");

  // Step 1: Load track or fallback playlist
  const loadCmd = cmds.loadFirstTrack ?? cmds.loadFallbackPlaylist;
  onLog(`LOADING → ${loadCmd.description ?? loadCmd.url}`);

  const loadRes = await fetch(loadCmd.url, {
    method: "POST",
    headers: {
      ...loadCmd.headers,
      "Content-Type": 'text/xml; charset="utf-8"',
    },
    body: loadCmd.body,
  });
  const loadBody = await loadRes.text();
  onLog(`SONOS LOAD → HTTP ${loadRes.status} ${loadRes.statusText}`);
  if (!loadRes.ok) {
    onLog(`SONOS LOAD ERROR → ${loadBody.slice(0, 200)}`);
    throw new Error(`Sonos load rejected: HTTP ${loadRes.status}`);
  }

  // Step 2: Fire play command to start playback
  onLog(`PLAYING → ${cmds.play.url}`);
  const playRes = await fetch(cmds.play.url, {
    method: "POST",
    headers: {
      ...cmds.play.headers,
      "Content-Type": 'text/xml; charset="utf-8"',
    },
    body: cmds.play.body,
  });
  const playBody = await playRes.text();
  onLog(`SONOS PLAY → HTTP ${playRes.status} ${playRes.statusText}`);
  if (!playRes.ok) {
    onLog(`SONOS PLAY ERROR → ${playBody.slice(0, 200)}`);
    throw new Error(`Sonos play rejected: HTTP ${playRes.status}`);
  }

  onLog("PLAYBACK STARTED ✓");
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
