import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Music, Search } from "lucide-react";
import { curateVibe } from "@/services/vibeApi";
import { executeLocalCommand } from "@/services/sonosControl";

const SPEAKER_IP = "192.168.88.3";

export function SpotifyModule() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);

    try {
      const cmd = await curateVibe(query, SPEAKER_IP);
      await executeLocalCommand(cmd);
      toast({ title: "▶ Playing", description: `Curating "${query}" on your speaker…` });
    } catch (err) {
      toast({ title: "Vibe Failed", description: String(err), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [query]);

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
            placeholder="Describe a vibe…"
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && search()}
            data-testid="input-vibe-query"
          />
          <Button onClick={search} disabled={searching} className="shrink-0 gap-2 font-mono text-xs" data-testid="button-curate">
            <Search className="h-4 w-4" />
            {searching ? "CURATING…" : "PLAY VIBE"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
