import { useEffect, useRef } from "react";

interface SystemConsoleProps {
  logs: string[];
}

const SystemConsole = ({ logs }: SystemConsoleProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="console-border rounded-lg p-4 h-48 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground tracking-widest uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          System Status
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none"
        >
          {logs.map((log, i) => (
            <p
              key={i}
              className="text-xs font-mono text-muted-foreground leading-relaxed animate-[fade-in_0.3s_ease-out]"
            >
              <span className="text-primary/60 mr-2">›</span>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemConsole;
