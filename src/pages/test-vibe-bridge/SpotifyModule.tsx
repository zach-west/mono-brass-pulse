import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { LogIn, Music, Search } from "lucide-react";

const SPOTIFY_CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID";
const SPOTIFY_SCOPES = "user-read-private";
const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/test-vibe-bridge` : "";

function getTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/access_token=([^&]+)/);

  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return match[1];
}

export function SpotifyModule() {
  const [token] = useState<string | null>(() => getTokenFromHash());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; artist: string; album: string; image: string }>>([]);
  const [searching, setSearching] = useState(false);

  const login = () => {
    if (SPOTIFY_CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID") {
      toast({
        title: "⚠ Client ID Required",
        description: "Set your Spotify Client ID in SpotifyModule.tsx and whitelist /test-vibe-bridge redirect.",
        variant: "destructive",
      });
      return;
    }

    const url = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`;
    window.location.href = url;
  };

  const search = useCallback(async () => {
    if (!token || !query.trim()) return;

    setSearching(true);

    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      const tracks = (data.tracks?.items ?? []) as Array<{
        name: string;
        artists?: Array<{ name?: string }>;
        album?: { name?: string; images?: Array<{ url?: string }> };
      }>;

      setResults(
        tracks.map((t) => ({
          name: t.name,
          artist: t.artists?.[0]?.name ?? "Unknown",
          album: t.album?.name ?? "",
          image: t.album?.images?.[2]?.url ?? "",
        }))
      );
    } catch (err) {
      toast({ title: "Search Failed", description: String(err), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [query, token]);

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Music className="h-5 w-5 text-primary" />
          MODULE B — DISTRIBUTED SPOTIFY SEARCH
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Implicit Grant flow — each user authenticates with their own quota directly from the client.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <Button onClick={login} className="w-full gap-2 font-mono text-xs">
            <LogIn className="h-4 w-4" />
            LOGIN TO SPOTIFY
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2 font-mono text-xs text-primary">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              AUTHENTICATED — User token active
            </div>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracks…"
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button onClick={search} disabled={searching} className="shrink-0 gap-2 font-mono text-xs">
                <Search className="h-4 w-4" />
                {searching ? "…" : "SEARCH"}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={`${result.name}-${index}`} className="flex items-center gap-3 rounded bg-muted/30 p-2 font-mono text-xs">
                    {result.image && <img src={result.image} alt={`${result.album} artwork`} className="h-8 w-8 rounded" loading="lazy" />}
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{result.name}</p>
                      <p className="truncate text-muted-foreground">
                        {result.artist} · {result.album}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
