/**
 * LongPressFAB - Floating Action Button with long-press gesture support
 * 
 * Phase 3C: Express report via 3-second long-press
 * - Short tap: navigates to report page (unchanged behavior)
 * - Long-press (3s): triggers express submission callback
 * - Progress ring shows while holding
 * - Cancel on early release or finger movement beyond threshold
 * - Haptic feedback on completion (graceful fallback)
 * - Double-fire prevention via latch
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPRESS_REPORT_CONFIG } from '@/lib/featureFlags';

interface LongPressFABProps {
  onShortTap: () => void;
  onLongPressComplete: () => void;
  onCooldownAttempt?: () => void;
  disabled?: boolean;
  cooldownActive?: boolean;
  className?: string;
  enableLongPress?: boolean;
}

export function LongPressFAB({
  onShortTap,
  onLongPressComplete,
  onCooldownAttempt,
  disabled = false,
  cooldownActive = false,
  className,
  enableLongPress = true,
}: LongPressFABProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const longPressCompletedRef = useRef(false);
  const hasFiredRef = useRef(false);

  const { LONG_PRESS_DURATION_MS, MOVEMENT_THRESHOLD_PX } = EXPRESS_REPORT_CONFIG;

  const cleanup = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
    startPositionRef.current = null;
  }, []);

  const triggerHaptic = useCallback(() => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 100]);
      }
    } catch {
      // Haptic not supported, fail silently
    }
  }, []);

  const handleLongPressComplete = useCallback(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    longPressCompletedRef.current = true;
    
    cleanup();
    triggerHaptic();
    onLongPressComplete();
  }, [cleanup, triggerHaptic, onLongPressComplete]);

  const handlePressStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    
    // Show cooldown feedback if trying to long-press during cooldown
    if (cooldownActive && enableLongPress) {
      onCooldownAttempt?.();
      return;
    }
    
    // If long-press is disabled, don't track - let onClick handle short taps
    if (!enableLongPress) return;
    
    // Reset flags for new gesture
    longPressCompletedRef.current = false;
    hasFiredRef.current = false;
    startPositionRef.current = { x: clientX, y: clientY };
    setIsHolding(true);
    setProgress(0);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / LONG_PRESS_DURATION_MS) * 100, 100);
      setProgress(pct);
    }, 16);

    holdTimerRef.current = setTimeout(() => {
      handleLongPressComplete();
    }, LONG_PRESS_DURATION_MS);
  }, [disabled, cooldownActive, enableLongPress, LONG_PRESS_DURATION_MS, handleLongPressComplete, onCooldownAttempt]);

  const handlePressMove = useCallback((clientX: number, clientY: number) => {
    if (!startPositionRef.current || !isHolding) return;
    
    const dx = Math.abs(clientX - startPositionRef.current.x);
    const dy = Math.abs(clientY - startPositionRef.current.y);
    
    if (dx > MOVEMENT_THRESHOLD_PX || dy > MOVEMENT_THRESHOLD_PX) {
      cleanup();
    }
  }, [isHolding, MOVEMENT_THRESHOLD_PX, cleanup]);

  const handlePressEnd = useCallback(() => {
    // If long-press completed, don't do anything on release
    // The short tap will be handled by onClick
    cleanup();
  }, [cleanup]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    // If long-press just completed, prevent the click
    if (longPressCompletedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressCompletedRef.current = false;
      return;
    }
    
    // Short tap: navigate to report page
    onShortTap();
  }, [disabled, onShortTap]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handlePressStart(touch.clientX, touch.clientY);
  }, [handlePressStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handlePressMove(touch.clientX, touch.clientY);
  }, [handlePressMove]);

  const onTouchEnd = useCallback(() => {
    handlePressEnd();
  }, [handlePressEnd]);

  // Mouse handlers (for desktop testing)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    handlePressStart(e.clientX, e.clientY);
  }, [handlePressStart]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    handlePressMove(e.clientX, e.clientY);
  }, [handlePressMove]);

  const onMouseUp = useCallback(() => {
    handlePressEnd();
  }, [handlePressEnd]);

  const onMouseLeave = useCallback(() => {
    if (isHolding) {
      cleanup();
    }
  }, [isHolding, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const circumference = 2 * Math.PI * 24;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative">
      <button
        data-testid="button-create-report"
        aria-label={cooldownActive ? "Express report cooling down" : "Create a report"}
        className={cn(
          "h-14 w-14 grid place-items-center rounded-2xl shadow-lg transition-all duration-200 text-white",
          isHolding 
            ? "bg-blue-700 scale-110" 
            : cooldownActive
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={disabled}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cleanup}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={handleClick}
      >
        <PlusCircle size={24} />
      </button>

      {isHolding && enableLongPress && (
        <svg
          className="absolute inset-0 w-14 h-14 -rotate-90 pointer-events-none"
          viewBox="0 0 56 56"
        >
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="4"
          />
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-75"
          />
        </svg>
      )}
    </div>
  );
}
