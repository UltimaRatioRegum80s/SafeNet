import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, UserPlus, Download, X } from "lucide-react";
import heroLogo from "@assets/Logo_1771316453745.png";
import { useAuthStore } from "@/store/auth";
import Reveal from "@/components/public/Reveal";
import { canInstall, triggerInstall, useIsInstalled } from "@/components/InstallPrompt";

interface HeroProps {
  bgImage?: string;
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function InstallInstructionsModal({ onClose, isIos }: { onClose: () => void; isIos: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Install NaborNet</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {isIos ? (
            <>
              <p>To install NaborNet on your device:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Tap the <strong>Share</strong> button in Safari</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> to confirm</li>
              </ol>
            </>
          ) : (
            <>
              <p>To install NaborNet on your device:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Open this site in <strong>Chrome</strong> or <strong>Edge</strong></li>
                <li>Tap the <strong>menu</strong> (three dots) in your browser</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></li>
              </ol>
            </>
          )}
        </div>
        <div className="mt-5">
          <Button onClick={onClose} variant="outline" size="sm" className="w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Hero({ bgImage }: HeroProps) {
  const { user } = useAuthStore();
  const isInstalled = useIsInstalled();
  const [showIosModal, setShowIosModal] = useState(false);
  const [installReady, setInstallReady] = useState(false);

  const isIos = detectIos();
  const isStandalone = typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  useEffect(() => {
    const check = () => setInstallReady(canInstall());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const showGetApp = !isInstalled && !isStandalone;

  const handleGetApp = useCallback(async () => {
    if (installReady) {
      await triggerInstall();
      setInstallReady(false);
      return;
    }
    setShowIosModal(true);
  }, [installReady]);

  return (
    <section className="nn-landing-hero relative overflow-hidden">
      {/* Deep blue gradient background with parallax */}
      <div
        className="absolute inset-0 pub-parallax-bg"
        style={{
          background: 'linear-gradient(180deg, #102d34 0%, #164b49 60%, #1c6157 100%)',
        }}
      />

      {bgImage && (
        <div
          className="absolute inset-0 pub-parallax-bg"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(2px) saturate(0.4) brightness(0.35)',
            opacity: 0.6,
          }}
        />
      )}

      {/* Geometric grid overlay at 5% opacity */}
      <div className="absolute inset-0 pub-hero-grid" />

      {/* Subtle blue glow behind logo - dark mode only */}
      <div
        className="absolute left-1/2 top-32 md:top-36 -translate-x-1/2 w-48 h-48 md:w-64 md:h-64 pointer-events-none dark:block hidden"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 50%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 py-24 md:py-32 px-4">
        <Reveal>
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <img
                src={heroLogo}
                alt="NaborNet"
                className="h-20 w-20 md:h-24 md:w-24 rounded-full"
              />
            </div>
            <span className="nn-hero-tag">LOCAL KNOWLEDGE. SHARED CARE.</span><h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-sm">
              A closer community.
                A safer every day.
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
              Know what is happening nearby. Share what matters. Connect with the people and services that make your neighborhood feel like home.
            </p>

            <div className="flex flex-col gap-3 justify-center pt-4">
              {user ? (
                <div className="flex justify-center">
                  <Link href="/community/map">
                    <Button size="lg" className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white px-8 shadow-lg">
                      Open the App
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-row gap-3 justify-center">
                  <Link href="/login">
                    <Button
                      size="lg"
                      variant="outline"
                      className="bg-transparent border-white/60 text-white hover:text-white hover:bg-white/10 hover:border-white/80 px-8"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="lg" className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white px-8 shadow-lg">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Join your neighborhood
                    </Button>
                  </Link>
                </div>
              )}

              {showGetApp && (
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-white/30 text-slate-400 hover:text-slate-200 hover:bg-white/5 px-6 text-xs tracking-wide"
                    onClick={handleGetApp}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Get the App
                  </Button>
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-slate-400 hover:text-white hover:bg-transparent px-8"
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  How it works
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {showIosModal && <InstallInstructionsModal isIos={isIos} onClose={() => setShowIosModal(false)} />}
    </section>
  );
}
