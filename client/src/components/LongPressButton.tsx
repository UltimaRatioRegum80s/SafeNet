import * as React from "react";
import { cn } from "@/lib/utils";

interface LongPressButtonProps {
  onLongPress: () => void;
  duration?: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  progressColor?: string;
}

export function LongPressButton({
  onLongPress,
  duration = 3000,
  disabled = false,
  className,
  children,
  progressColor = "#DC2626",
}: LongPressButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timerRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const animationRef = React.useRef<number | null>(null);

  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const updateProgress = () => {
    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min((elapsed / duration) * 100, 100);
    setProgress(newProgress);

    if (newProgress < 100) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const startPress = () => {
    if (disabled) return;
    
    setIsPressed(true);
    setProgress(0);
    startTimeRef.current = Date.now();
    triggerHaptic();

    animationRef.current = requestAnimationFrame(updateProgress);

    timerRef.current = window.setTimeout(() => {
      setIsPressed(false);
      setProgress(0);
      triggerHaptic();
      onLongPress();
    }, duration);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPressed(false);
    setProgress(0);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center select-none touch-none",
        "transition-transform active:scale-95",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative flex items-center justify-center">
        <svg
          className={cn(
            "absolute inset-0 -rotate-90 transition-opacity duration-150",
            isPressed ? "opacity-100" : "opacity-0"
          )}
          width="56"
          height="56"
          viewBox="0 0 56 56"
        >
          <circle
            cx="28"
            cy="28"
            r="22"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="4"
          />
          <circle
            cx="28"
            cy="28"
            r="22"
            fill="none"
            stroke={progressColor}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>
        <div className="z-10 flex items-center justify-center min-w-[48px] min-h-[48px] px-4 py-2 rounded-full bg-red-600 text-white font-medium text-sm">
          {children}
        </div>
      </div>
    </button>
  );
}
