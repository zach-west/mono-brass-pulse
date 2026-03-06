import { useState, useCallback } from "react";

interface BrassButtonProps {
  onPress: () => void;
}

const BrassButton = ({ onPress }: BrassButtonProps) => {
  const [isPulsing, setIsPulsing] = useState(false);

  const handlePress = useCallback(() => {
    setIsPulsing(true);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    onPress();

    setTimeout(() => setIsPulsing(false), 600);
  }, [onPress]);

  return (
    <button
      onClick={handlePress}
      className={`
        w-36 h-36 sm:w-44 sm:h-44 rounded-full
        brass-gradient brass-glow
        border-2 border-brass-dark
        cursor-pointer select-none
        transition-transform duration-100
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-primary/50
        relative
        ${isPulsing ? "brass-glow-pulse" : ""}
      `}
      aria-label="Action button"
    >
      {/* Inner ring detail */}
      <div className="absolute inset-4 rounded-full border border-background/20" />
      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-background/40" />
      </div>
    </button>
  );
};

export default BrassButton;
