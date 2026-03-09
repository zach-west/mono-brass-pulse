import { useState, useCallback } from "react";
import { Mic } from "lucide-react";

interface BrassButtonProps {
  onPress: () => void;
  isRecording?: boolean;
}

const BrassButton = ({ onPress, isRecording = false }: BrassButtonProps) => {
  const [isPulsing, setIsPulsing] = useState(false);

  const handlePress = useCallback(() => {
    setIsPulsing(true);

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    onPress();

    setTimeout(() => setIsPulsing(false), 600);
  }, [onPress]);

  return (
    <button
      onClick={handlePress}
      data-testid="button-brass"
      className={`
        w-36 h-36 sm:w-44 sm:h-44 rounded-full
        brass-gradient brass-glow
        border-2 border-brass-dark
        cursor-pointer select-none
        transition-transform duration-100
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-primary/50
        relative
        ${isPulsing || isRecording ? "brass-glow-pulse" : ""}
      `}
      aria-label={isRecording ? "Stop listening" : "Speak a vibe"}
    >
      <div className="absolute inset-4 rounded-full border border-background/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        {isRecording ? (
          <Mic className="w-6 h-6 text-background/70 animate-pulse" />
        ) : (
          <div className="w-3 h-3 rounded-full bg-background/40" />
        )}
      </div>
      {isRecording && (
        <div className="absolute inset-0 rounded-full border-2 border-background/30 animate-ping" />
      )}
    </button>
  );
};

export default BrassButton;
