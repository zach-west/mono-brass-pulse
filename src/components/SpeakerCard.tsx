import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Volume2, VolumeX, Wifi, Play, Pause } from "lucide-react";
import * as sonos from "@/services/sonosControl";
import { getCommand } from "@/services/vibeApi";

interface SpeakerCardProps {
  name: string;
  ip: string;
  onLog: (msg: string) => void;
}

const SpeakerCard = ({ name, ip, onLog }: SpeakerCardProps) => {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(30);
  const [loading, setLoading] = useState(false);

  const exec = useCallback(
    async (label: string, fn: () => Promise<void>, onSuccess?: () => void) => {
      setLoading(true);
      try {
        await fn();
        onSuccess?.();
        onLog(`[${label}] OK → ${ip}`);
      } catch {
        onLog(`[ERROR] ${label} failed → ${ip}`);
        toast({
          title: "Command Failed",
          description: "Check WiFi permissions — ensure you're on the same network as the speaker.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [ip, onLog],
  );

  return (
    <div className="console-border rounded-lg p-4 space-y-3">
      {/* Header */}
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
            onCheckedChange={(checked) =>
              exec(checked ? "MUTE" : "UNMUTE", async () => {
                const cmd = await getCommand(checked ? "mute" : "unmute", ip);
                await sonos.executeLocalCommand(cmd);
              }, () => {
                setMuted(checked);
                toast({ title: checked ? "🔇 Muted" : "🔊 Unmuted", description: `Command sent to ${name}` });
              })
            }
            disabled={loading}
            aria-label="Quick Mute"
          />
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            exec(
              playing ? "PAUSE" : "PLAY",
              async () => {
                const cmd = await getCommand(playing ? "pause" : "play", ip);
                await sonos.executeLocalCommand(cmd);
              },
              () => setPlaying(!playing),
            )
          }
          disabled={loading}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Volume Slider */}
        <div className="flex-1 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueCommit={(val) => {
              const v = val[0];
              exec("VOLUME", () => sonos.setVolume(ip, v), () => setVolume(v));
            }}
            onValueChange={(val) => setVolume(val[0])}
            disabled={loading}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-7 text-right font-mono">{volume}</span>
        </div>
      </div>
    </div>
  );
};

export default SpeakerCard;
