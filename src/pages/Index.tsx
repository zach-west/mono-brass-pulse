import { useState, useCallback } from "react";
import BrassButton from "@/components/BrassButton";
import SystemConsole from "@/components/SystemConsole";
import SpeakerCard from "@/components/SpeakerCard";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Radio } from "lucide-react";
import { requestLocalNetworkAccess } from "@/services/permissions";

interface Speaker {
  id: string;
  name: string;
  ip: string;
}

const MESSAGES = [
  "LISTENING...",
  "SIGNAL ACQUIRED",
  "PROCESSING...",
  "CHANNEL OPEN",
  "AWAITING INPUT...",
  "RESONANCE DETECTED",
  "CALIBRATING...",
  "SYNC COMPLETE",
];

const Index = () => {
  const [logs, setLogs] = useState<string[]>(["SYSTEM READY...", "STANDING BY..."]);
  const [pressCount, setPressCount] = useState(0);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [searching, setSearching] = useState(false);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  const handlePress = useCallback(() => {
    const msg = MESSAGES[pressCount % MESSAGES.length];
    addLog(msg);
    setPressCount((c) => c + 1);
  }, [pressCount, addLog]);

  const searchForSpeakers = useCallback(async () => {
    setSearching(true);
    addLog("REQUESTING NETWORK PERMISSIONS...");

    await requestLocalNetworkAccess();
    addLog("SCANNING LOCAL NETWORK...");

    const knownIp = "192.168.88.3";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch(`http://${knownIp}:1400/xml/device_description.xml`, {
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const existing = speakers.find((s) => s.ip === knownIp);
      if (!existing) {
        setSpeakers((prev) => [...prev, { id: knownIp, name: "Sonos Beam", ip: knownIp }]);
        addLog(`DEVICE FOUND → Sonos Beam (${knownIp})`);
        toast({ title: "🔊 Speaker Found", description: `Sonos Beam at ${knownIp}` });
      } else {
        addLog("DEVICE ALREADY CONNECTED");
      }
    } catch {
      addLog("SCAN TIMEOUT — Check WiFi permissions");
      toast({
        title: "No Speakers Found",
        description: "Check WiFi permissions and ensure you're on the same network as your speakers.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  }, [addLog, speakers]);

  const addManualSpeaker = useCallback(() => {
    const knownIp = "192.168.88.3";
    const existing = speakers.find((s) => s.ip === knownIp);
    if (!existing) {
      setSpeakers((prev) => [...prev, { id: knownIp, name: "Sonos Beam", ip: knownIp }]);
      addLog(`MANUAL ADD → Sonos Beam (${knownIp})`);
    }
  }, [speakers, addLog]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-10 bg-background py-12">
      <h1 className="text-sm tracking-[0.4em] uppercase text-muted-foreground font-light">
        Mono
      </h1>

      <BrassButton onPress={handlePress} />

      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground">
            <Radio className="w-3.5 h-3.5" />
            Connected Speakers
          </div>
          <button
            onClick={addManualSpeaker}
            className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            aria-label="Add speaker manually"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {speakers.length === 0 ? (
          <div className="console-border rounded-lg p-6 flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-muted-foreground">No speakers connected</p>
            <button
              onClick={searchForSpeakers}
              disabled={searching}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium tracking-wider uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {searching ? "Scanning…" : "Search for Speakers"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {speakers.map((speaker) => (
              <SpeakerCard
                key={speaker.id}
                name={speaker.name}
                ip={speaker.ip}
                onLog={addLog}
              />
            ))}
            <button
              onClick={searchForSpeakers}
              disabled={searching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {searching ? "Scanning…" : "Search for More"}
            </button>
          </div>
        )}
      </div>

      <SystemConsole logs={logs} />
    </div>
  );
};

export default Index;
