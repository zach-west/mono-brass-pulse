import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Volume2, VolumeX, Wifi } from "lucide-react";

interface SpeakerCardProps {
  name: string;
  ip: string;
  onLog: (msg: string) => void;
}

const SpeakerCard = ({ name, ip, onLog }: SpeakerCardProps) => {
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendMuteCommand = useCallback(async (desiredMute: boolean) => {
    setLoading(true);
    const target = `http://${ip}:1400/MediaRenderer/RenderingControl/Control`;
    const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>${desiredMute ? 1 : 0}</DesiredMute></u:SetMute></s:Body></s:Envelope>`;

    try {
      await fetch(target, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPACTION: '"urn:schemas-upnp-org:service:RenderingControl:1#SetMute"',
        },
        body,
      });

      setMuted(desiredMute);
      onLog(`[MUTE] ${desiredMute ? "ON" : "OFF"} → ${ip}`);
      toast({
        title: desiredMute ? "🔇 Muted" : "🔊 Unmuted",
        description: `Command sent to ${name}`,
      });
    } catch (err) {
      onLog(`[ERROR] Mute failed → ${ip}`);
      toast({
        title: "Command Failed",
        description: "Check WiFi permissions — ensure you're on the same network as the speaker.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [ip, name, onLog]);

  return (
    <div className="console-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground tracking-wide">{name}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wifi className="w-3 h-3" />
              <span>{ip}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {muted ? (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Volume2 className="w-4 h-4 text-primary" />
          )}
          <Switch
            checked={muted}
            onCheckedChange={(checked) => sendMuteCommand(checked)}
            disabled={loading}
            aria-label="Quick Mute"
          />
        </div>
      </div>
    </div>
  );
};

export default SpeakerCard;
