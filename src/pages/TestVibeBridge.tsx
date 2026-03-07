import { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wifi, WifiOff, Volume2, VolumeX, Music, Search, LogIn } from "lucide-react";

// ── Module A: Local Sonos Control ──────────────────────────────────────────

function classifyError(err: unknown): { type: "cors" | "timeout" | "network" | "unknown"; message: string } {
  if (err instanceof TypeError && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
    return {
      type: "cors",
      message: "Request blocked — likely CORS / Private Network Access restriction. The browser refuses cross-origin requests to local IPs by default.",
    };
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return { type: "timeout", message: "Request timed out — the device may be unreachable on this network." };
  }
  return { type: "unknown", message: String(err) };
}

function SonosModule() {
  const [ip, setIp] = useState("192.168.1.50");
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [deviceInfo, setDeviceInfo] = useState<string | null>(null);
  const [muteState, setMuteState] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const testConnection = useCallback(async () => {
    setStatus("testing");
    setDeviceInfo(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`http://${ip}:1400/xml/device_description.xml`, {
        signal: controller.signal,
      });
      const text = await res.text();
      const match = text.match(/<friendlyName>([^<]+)<\/friendlyName>/);
      setDeviceInfo(match ? match[1] : "Device found (name unknown)");
      setStatus("connected");
      toast({ title: "✅ Handshake OK", description: `Connected to ${match?.[1] ?? ip}` });
    } catch (err) {
      const classified = classifyError(err);
      setStatus("error");
      toast({
        title: classified.type === "cors" ? "🔒 Security / CORS Error" : classified.type === "timeout" ? "⏱ Timeout" : "❌ Error",
        description: classified.message,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeout);
    }
  }, [ip]);

  const toggleMute = useCallback(async () => {
    const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>${muteState}</DesiredMute></u:SetMute></s:Body></s:Envelope>`;

    try {
      await fetch(`http://${ip}:1400/MediaRenderer/RenderingControl/Control`, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPACTION: '"urn:schemas-upnp-org:service:RenderingControl:1#SetMute"',
        },
        body,
      });
      toast({ title: muteState ? "🔇 Muted" : "🔊 Unmuted", description: `Sent to ${ip}` });
      setMuteState((s) => (s === 1 ? 0 : 1));
    } catch (err) {
      const classified = classifyError(err);
      toast({ title: "UPnP Command Failed", description: classified.message, variant: "destructive" });
    }
  }, [ip, muteState]);

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Volume2 className="w-5 h-5 text-primary" />
          MODULE A — LOCAL SONOS CONTROL
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Tests browser→LAN UPnP communication. Validates Private Network Access permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="Speaker IP"
            className="font-mono text-sm"
          />
          <Button onClick={testConnection} disabled={status === "testing"} className="shrink-0 font-mono text-xs">
            {status === "testing" ? "TESTING…" : "TEST CONNECTION"}
          </Button>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {status === "connected" ? (
            <Wifi className="w-4 h-4 text-green-400" />
          ) : status === "error" ? (
            <WifiOff className="w-4 h-4 text-destructive" />
          ) : (
            <Wifi className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            {status === "idle" && "Awaiting test…"}
            {status === "testing" && "Attempting handshake…"}
            {status === "connected" && (deviceInfo ?? "Connected")}
            {status === "error" && "Connection failed"}
          </span>
        </div>

        <Button
          onClick={toggleMute}
          variant="outline"
          disabled={status !== "connected"}
          className="w-full font-mono text-xs gap-2"
        >
          {muteState ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          TOGGLE MUTE (→ {muteState ? "MUTE" : "UNMUTE"})
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Module B: Distributed Spotify Search ───────────────────────────────────

const SPOTIFY_CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID"; // Replace with your Spotify app client ID
const SPOTIFY_SCOPES = "user-read-private";
const REDIRECT_URI = typeof window !== "undefined" ? window.location.origin + "/test-vibe-bridge" : "";

function getTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/access_token=([^&]+)/);
  if (match) {
    // Clean up hash
    window.history.replaceState(null, "", window.location.pathname);
    return match[1];
  }
  return null;
}

function SpotifyModule() {
  const [token, setToken] = useState<string | null>(() => getTokenFromHash());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; artist: string; album: string; image: string }>>([]);
  const [searching, setSearching] = useState(false);

  const login = () => {
    if (SPOTIFY_CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID") {
      toast({
        title: "⚠ Client ID Required",
        description: "Set your Spotify Client ID in TestVibeBridge.tsx. Create one at developer.spotify.com.",
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
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(
        (data.tracks?.items ?? []).map((t: any) => ({
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
  }, [token, query]);

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Music className="w-5 h-5 text-primary" />
          MODULE B — DISTRIBUTED SPOTIFY SEARCH
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Implicit Grant flow — each user authenticates with their own quota. No backend needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <Button onClick={login} className="w-full font-mono text-xs gap-2">
            <LogIn className="w-4 h-4" />
            LOGIN TO SPOTIFY
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2 font-mono text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
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
              <Button onClick={search} disabled={searching} className="shrink-0 font-mono text-xs gap-2">
                <Search className="w-4 h-4" />
                {searching ? "…" : "SEARCH"}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30 font-mono text-xs">
                    {r.image && <img src={r.image} alt="" className="w-8 h-8 rounded" />}
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{r.name}</p>
                      <p className="truncate text-muted-foreground">{r.artist} · {r.album}</p>
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

// ── Page ────────────────────────────────────────────────────────────────────

const TestVibeBridge = () => (
  <div className="min-h-[100dvh] bg-background px-4 py-8 max-w-lg mx-auto space-y-6">
    <div className="text-center space-y-1">
      <h1 className="font-mono text-sm tracking-[0.4em] uppercase text-muted-foreground">
        Vibe Bridge — Tech Spike
      </h1>
      <p className="font-mono text-[10px] text-muted-foreground/60">
        Local-first architecture validation
      </p>
    </div>
    <SonosModule />
    <SpotifyModule />
  </div>
);

export default TestVibeBridge;
