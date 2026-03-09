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
}

export async function getCommand(
  action: "play" | "pause" | "mute" | "unmute",
  speakerIp: string,
): Promise<LocalCommand> {
  const res = await fetch(`${REPLIT_API_URL}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, speakerIp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>)?.error as string ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<LocalCommand>;
}

export async function curateVibe(
  query: string,
  speakerIp: string,
): Promise<LocalCommand> {
  const res = await fetch(`${REPLIT_API_URL}/api/curate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, speakerIp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as Record<string, unknown>)?.error as string ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<LocalCommand>;
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
