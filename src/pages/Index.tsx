import { useState, useCallback, useEffect, useRef } from "react";
import BrassButton from "@/components/BrassButton";
import SystemConsole from "@/components/SystemConsole";
import SpeakerCard from "@/components/SpeakerCard";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Radio, FlaskConical } from "lucide-react";
import { requestLocalNetworkAccess } from "@/services/permissions";
import { REPLIT_API_URL, executeVibeChain } from "@/services/vibeApi";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

interface Speaker {
  id: string;
  name: string;
  ip: string;
}

const Index = () => {
  const [logs, setLogs] = useState<string[]>(["SYSTEM READY...", "STANDING BY..."]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [searching, setSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [testingVibe, setTestingVibe] = useState(false);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const stateListenerRef = useRef<{ remove: () => void } | null>(null);
  const resultReceivedRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  useEffect(() => {
    return () => {
      listenerRef.current?.remove();
      stateListenerRef.current?.remove();
    };
  }, []);

  const runVibeFromText = useCallback(
    async (text: string) => {
      const speakerIp = speakers[0]?.ip;
      if (!speakerIp) {
        addLog("NO SPEAKER → Add a speaker first");
        toast({ title: "No Speaker Connected", description: "Add a Sonos speaker first.", variant: "destructive" });
        return;
      }
      try {
        await executeVibeChain(text, speakerIp, addLog);
        toast({ title: "▶ Playing", description: `"${text}"` });
      } catch (err) {
        addLog(`CHAIN ERROR → ${String(err)}`);
        toast({ title: "Vibe Failed", description: String(err), variant: "destructive" });
      }
    },
    [speakers, addLog],
  );

  const stopRecording = useCallback(async () => {
    listenerRef.current?.remove();
    listenerRef.current = null;
    stateListenerRef.current?.remove();
    stateListenerRef.current = null;
    if (Capacitor.isNativePlatform()) {
      try { await SpeechRecognition.stop(); } catch { /* already stopped */ }
    }
    setIsRecording(false);
  }, []);

  const startNativeRecording = useCallback(async () => {
    const { speechRecognition } = await SpeechRecognition.requestPermissions();
    if (speechRecognition !== "granted") {
      toast({ title: "Microphone Access Denied", description: "Allow microphone in device settings.", variant: "destructive" });
      return;
    }

    resultReceivedRef.current = false;
    setIsRecording(true);
    addLog("LISTENING...");

    // Fail-safe: if recognition stops without a result (timeout / error / silence),
    // reset the UI so the user is never stuck in LISTENING mode.
    stateListenerRef.current = await SpeechRecognition.addListener(
      "listeningState",
      (data: { status: "started" | "stopped" }) => {
        if (data.status === "stopped" && !resultReceivedRef.current) {
          addLog("MIC STOPPED — no result, resetting UI");
          setIsRecording(false);
          stateListenerRef.current?.remove();
          stateListenerRef.current = null;
        }
      },
    );

    listenerRef.current = await SpeechRecognition.addListener(
      "partialResults",
      async (data: { matches: string[] }) => {
        const text = data.matches?.[0];
        if (!text) return;
        resultReceivedRef.current = true;
        await stopRecording();
        addLog(`TRANSCRIPTION → "${text}"`);
        await runVibeFromText(text);
      },
    );

    try {
      await SpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        partialResults: true,
        popup: false,
      });
    } catch (err) {
      addLog(`MIC ERROR → ${String(err)}`);
      await stopRecording();
    }
  }, [addLog, stopRecording, runVibeFromText]);

  const startWebRecording = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition;

    if (!SpeechRecognitionAPI) {
      const fallback = window.prompt("Speak a vibe (type it here):");
      if (fallback?.trim()) {
        addLog(`INPUT → "${fallback.trim()}"`);
        runVibeFromText(fallback.trim());
      }
      return;
    }

    const recognition = new (SpeechRecognitionAPI as unknown as new () => SpeechRecognition)();
    (recognition as unknown as { lang: string }).lang = "en-US";
    (recognition as unknown as { maxAlternatives: number }).maxAlternatives = 1;

    setIsRecording(true);
    addLog("LISTENING...");

    (recognition as unknown as { onresult: (e: SpeechRecognitionEvent) => void }).onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setIsRecording(false);
      addLog(`TRANSCRIPTION → "${text}"`);
      runVibeFromText(text);
    };
    (recognition as unknown as { onerror: () => void }).onerror = () => setIsRecording(false);
    (recognition as unknown as { onend: () => void }).onend = () => setIsRecording(false);
    (recognition as unknown as { start: () => void }).start();
  }, [addLog, runVibeFromText]);

  const handleBrassPress = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      addLog("RECORDING STOPPED");
      return;
    }

    if (navigator.vibrate) navigator.vibrate(50);

    if (Capacitor.isNativePlatform()) {
      await startNativeRecording();
    } else {
      startWebRecording();
    }
  }, [isRecording, stopRecording, addLog, startNativeRecording, startWebRecording]);

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
        toast({ title: "Speaker Found", description: `Sonos Beam at ${knownIp}` });
      } else {
        addLog("DEVICE ALREADY CONNECTED");
      }
    } catch {
      addLog("SCAN TIMEOUT — Check WiFi permissions");
      toast({
        title: "No Speakers Found",
        description: "Check WiFi and ensure you're on the same network.",
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

  const testVibe = useCallback(async () => {
    setTestingVibe(true);
    const speakerIp = speakers[0]?.ip ?? "192.168.88.3";
    addLog(`TEST VIBE → "late night house" → ${speakerIp}`);
    try {
      await executeVibeChain("late night house", speakerIp, addLog);
      toast({ title: "▶ Test Vibe Sent", description: "Check SYSTEM STATUS for Sonos response." });
    } catch (err) {
      addLog(`TEST ERROR → ${String(err)}`);
      toast({ title: "Test Failed", description: String(err), variant: "destructive" });
    } finally {
      setTestingVibe(false);
    }
  }, [addLog, speakers]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-10 bg-background py-12">
      <h1 className="text-sm tracking-[0.4em] uppercase text-muted-foreground font-light">
        Mono
      </h1>

      <div className="flex flex-col items-center gap-2">
        <BrassButton onPress={handleBrassPress} isRecording={isRecording} />
        {isRecording && (
          <p className="text-xs text-primary tracking-widest uppercase animate-pulse">
            Listening…
          </p>
        )}
      </div>

      <button
        onClick={testVibe}
        disabled={testingVibe}
        data-testid="button-test-vibe"
        className="flex items-center gap-2 px-4 py-2 rounded-md border border-primary/40 text-xs text-primary tracking-widest uppercase hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        {testingVibe ? "Testing…" : "Test Vibe"}
      </button>

      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground">
            <Radio className="w-3.5 h-3.5" />
            Connected Speakers
          </div>
          <button
            onClick={addManualSpeaker}
            data-testid="button-add-speaker"
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
              data-testid="button-search-speakers"
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
              data-testid="button-search-more"
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
