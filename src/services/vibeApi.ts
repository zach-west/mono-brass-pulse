export const REPLIT_API_URL = "https://mono-vibe-maker.replit.app";

export interface VibeTrack {
  name: string;
  artist: string;
  album: string;
  image: string;
  uri?: string;
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
