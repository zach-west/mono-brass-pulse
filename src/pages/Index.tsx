import { useState, useCallback } from "react";
import BrassButton from "@/components/BrassButton";
import SystemConsole from "@/components/SystemConsole";

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

  const handlePress = useCallback(() => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const msg = MESSAGES[pressCount % MESSAGES.length];
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
    setPressCount((c) => c + 1);
  }, [pressCount]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-12 bg-background">
      {/* Title */}
      <h1 className="text-sm tracking-[0.4em] uppercase text-muted-foreground font-light">
        Mono
      </h1>

      {/* Brass Button */}
      <BrassButton onPress={handlePress} />

      {/* Console */}
      <SystemConsole logs={logs} />
    </div>
  );
};

export default Index;
