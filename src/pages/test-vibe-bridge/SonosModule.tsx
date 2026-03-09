import { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { classifyError, fetchViaLanProxy } from "./network";

export function SonosModule() {
  const [ip, setIp] = useState("192.168.88.3");
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
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const target = `http://${ip}:1400/xml/device_description.xml`;
      const res = await fetchViaLanProxy(target, { signal: controller.signal }, "cors");
      const text = await res.text();
      const match = text.match(/<friendlyName>([^<]+)<\/friendlyName>/);
      setDeviceInfo(match ? match[1] : "Device found (name unknown)");
      setStatus("connected");
      toast({ title: "✅ Proxy Handshake OK", description: `Connected to ${match?.[1] ?? ip}` });
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
    const target = `http://${ip}:1400/MediaRenderer/RenderingControl/Control`;
    const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>${muteState}</DesiredMute></u:SetMute></s:Body></s:Envelope>`;

    try {
      await fetchViaLanProxy(
        target,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPACTION: '"urn:schemas-upnp-org:service:RenderingControl:1#SetMute"',
          },
          body,
        },
        "cors"
      );

      setMuteState((s) => (s === 1 ? 0 : 1));
      toast({ title: muteState ? "🔇 Muted" : "🔊 Unmuted", description: `SOAP via proxy -> ${ip}` });
    } catch (err) {
      try {
        await fetchViaLanProxy(
          target,
          {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=UTF-8",
            },
            body,
          },
          "no-cors"
        );

        setMuteState((s) => (s === 1 ? 0 : 1));
        toast({
          title: "⚡ no-cors Attempt Sent",
          description: "Opaque send completed. Response is unreadable by design, but command may have reached speaker.",
        });
      } catch (fallbackErr) {
        const classified = classifyError(fallbackErr ?? err);
        toast({ title: "UPnP Command Failed", description: classified.message, variant: "destructive" });
      }
    }
  }, [ip, muteState]);

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-mono tracking-wider">
          <Volume2 className="h-5 w-5 text-primary" />
          MODULE A — LOCAL SONOS CONTROL (SW PROXY)
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Routes LAN requests through Service Worker first, then falls back to no-cors command dispatch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Speaker IP" className="font-mono text-sm" />
          <Button onClick={testConnection} disabled={status === "testing"} className="shrink-0 font-mono text-xs">
            {status === "testing" ? "TESTING…" : "TEST CONNECTION"}
          </Button>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {status === "connected" ? (
            <Wifi className="h-4 w-4 text-primary" />
          ) : status === "error" ? (
            <WifiOff className="h-4 w-4 text-destructive" />
          ) : (
            <Wifi className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            {status === "idle" && "Awaiting test…"}
            {status === "testing" && "Attempting handshake via Service Worker…"}
            {status === "connected" && (deviceInfo ?? "Connected")}
            {status === "error" && "Connection failed"}
          </span>
        </div>

        <Button onClick={toggleMute} variant="outline" disabled={status !== "connected"} className="w-full gap-2 font-mono text-xs">
          {muteState ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          TOGGLE MUTE (SOAP → no-cors fallback)
        </Button>
      </CardContent>
    </Card>
  );
}
