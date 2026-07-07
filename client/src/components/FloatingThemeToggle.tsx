import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function FloatingThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [pulse, setPulse] = useState(false);

  const handleToggle = () => {
    // Get current effective theme (resolve 'system' to actual theme)
    const currentTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    // Toggle between light and dark
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
    
    // Trigger pulse animation
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
    
    // Optional haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  // Get effective theme for icon display
  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <motion.button
      onClick={handleToggle}
      aria-label="Toggle theme"
      data-testid="floating-theme-toggle"
      whileTap={{ scale: 0.9 }}
      className={cn(
        // Position - top right with safe area
        "fixed right-4 top-[calc(env(safe-area-inset-top)+10px)] z-[56]",
        // Only show on mobile
        "xl:hidden",
        // Size and shape
        "h-10 w-10 flex items-center justify-center rounded-full",
        // Glass effect
        "bg-neutral-900/70 dark:bg-neutral-100/40",
        "backdrop-blur-md",
        "border border-white/10 dark:border-neutral-700/30",
        // Shadow
        "shadow-[0_4px_12px_rgba(0,0,0,0.25)]",
        "dark:shadow-[0_4px_12px_rgba(255,255,255,0.1)]",
        // Interactions
        "transition-all duration-300",
        "hover:scale-105 active:scale-95",
        // Focus state
        "focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:outline-none"
      )}
    >
      {/* Pulse effect on toggle */}
      {pulse && (
        <motion.span
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn(
            "absolute inset-0 rounded-full",
            effectiveTheme === 'dark' 
              ? "bg-yellow-400/30" 
              : "bg-blue-500/30"
          )}
        />
      )}

      {/* Icon with rotation animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveTheme}
          initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          {effectiveTheme === 'dark' ? (
            <Sun size={18} className="text-yellow-400" />
          ) : (
            <Moon size={18} className="text-blue-500" />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
