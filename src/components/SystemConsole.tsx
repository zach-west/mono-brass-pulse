import { useEffect, useRef, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface SystemConsoleProps {
  logs: string[];
}

const SystemConsole = ({ logs }: SystemConsoleProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = useCallback(() => {
    const text = logs.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [logs]);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="console-border rounded-lg p-4 h-56 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            System Status
          </div>
          <button
            onClick={copyLogs}
            data-testid="button-copy-logs"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            <span className="tracking-wide">{copied ? "Copied" : "Copy"}</span>
          </button>
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
