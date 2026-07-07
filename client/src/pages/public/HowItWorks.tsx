import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Bell, Shield, Eye } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import PublicLayout from "@/components/public/PublicLayout";

export default function HowItWorks() {
  const { user } = useAuthStore();

  return (
    <PublicLayout>
      <div className="py-12 md:py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[var(--pub-text)] mb-4">How NaborNet Works</h1>
            <p className="text-[var(--pub-text-secondary)] mb-8">
              A simple guide to using NaborNet for neighbourhood awareness.
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--pub-accent)] font-bold">1</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-[var(--pub-text)] flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[var(--pub-accent)]" />
                    View the Feed & Map
                  </h2>
                  <p className="text-[var(--pub-text-secondary)]">
                    See what neighbours have reported in your area. The feed shows recent observations, 
                    and the map gives you a geographic view. Reports are filtered by distance and time 
                    to keep things relevant.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--pub-accent)] font-bold">2</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-[var(--pub-text)] flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[var(--pub-accent)]" />
                    Report What You See
                  </h2>
                  <p className="text-[var(--pub-text-secondary)]">
                    If you observe something worth sharing, tap the report button. Choose a category 
                    that fits, add a brief description if needed. Your location is used to place 
                    the report on the map — you can adjust it if needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--pub-accent)] font-bold">3</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-[var(--pub-text)] flex items-center gap-2">
                    <Users className="h-5 w-5 text-[var(--pub-accent)]" />
                    Community Signals
                  </h2>
                  <p className="text-[var(--pub-text-secondary)]">
                    Other users can signal whether a report needs more or less attention. These are 
                    informal community signals, not verification. Use your own judgement about 
                    any report you see.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--pub-accent)] font-bold">4</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-[var(--pub-text)] flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[var(--pub-accent)]" />
                    Stay Updated
                  </h2>
                  <p className="text-[var(--pub-text-secondary)]">
                    Reports appear in real-time as neighbours submit them. Check in periodically to 
                    stay aware of activity in your area. Reports older than a few days are 
                    automatically removed to keep information fresh.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--pub-accent)] font-bold">5</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-[var(--pub-text)] flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[var(--pub-accent)]" />
                    Use Your Judgement
                  </h2>
                  <p className="text-[var(--pub-text-secondary)]">
                    All reports are unverified observations from community members. NaborNet helps 
                    you see what others are seeing, but it's up to you to decide what to do with 
                    that information. When in doubt, contact appropriate authorities.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 space-y-4">
            {user ? (
              <Link href="/community/map">
                <Button className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white px-8">
                  Open the App
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button className="bg-[var(--pub-accent)] hover:bg-[var(--pub-accent-hover)] text-white px-8">
                  Get Started
                </Button>
              </Link>
            )}
            <div>
              <Link href="/safety">
                <Button variant="ghost" className="text-[var(--pub-text-secondary)] hover:text-[var(--pub-text)]">
                  Read about Safety & Limitations
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
