import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Music, Search, Play } from "lucide-react";
import { searchVibes, type VibeTrack } from "@/services/vibeApi";
import { setAVTransportURI, play as sonosPlay } from "@/services/sonosControl";

const SPEAKER_IP = "192.168.88.3";

export function SpotifyModule() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VibeTrack[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);

    try {
      const tracks = await searchVibes(query);
      setResults(tracks);
      if (tracks.length === 0) {
        toast({ title: "No Results", description: "Try a different search term." });
      }
    } catch (err) {
      toast({ title: "Search Failed", description: String(err), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [query]);

  const playOnSpeaker = useCallback(async (track: VibeTrack) => {
    if (!track.uri) {
      toast({ title: "No URI", description: "This track has no playable URI.", variant: "destructive" });
      return;
    }
    try {
      await setAVTransportURI(SPEAKER_IP, track.uri);
      await sonosPlay(SPEAKER_IP);
      toast({ title: "▶ Playing", description: `${track.name} — ${track.artist}` });
    } catch {
      toast({ title: "Playback Failed", description: "Check WiFi permissions and speaker connection.", variant: "destructive" });
    }
  }, []);

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Music className="h-5 w-5 text-primary" />
          MODULE B — VIBE DISCOVERY (Replit Brain)
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Fetches tracks from the Replit backend — no Spotify auth required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vibes…"
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{result.name}</p>
                  <p className="truncate text-muted-foreground">
                    {result.artist} · {result.album}
                  </p>
                </div>
                {result.uri && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 w-7 p-0"
                    onClick={() => playOnSpeaker(result)}
                    aria-label={`Play ${result.name} on speaker`}
                  >
                    <Play className="h-3.5 w-3.5 text-primary" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
