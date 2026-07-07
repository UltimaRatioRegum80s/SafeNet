import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Shield } from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";

export default function About() {
  return (
    <PublicLayout>
      <div className="py-12 md:py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[var(--pub-text)] mb-4">About NaborNet</h1>
            <p className="text-[var(--pub-text-secondary)] mb-8">
              A community-driven platform for neighbourhood situational awareness.
            </p>
          </div>

          <div className="bg-[var(--pub-surface)] border border-[var(--pub-border)] rounded-xl p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--pub-accent)]" />
                Our Purpose
              </h2>
              <p className="text-[var(--pub-text-secondary)]">
                NaborNet helps neighbours share observations about what's happening in their area. 
                It's a simple way to stay informed and connected with your community.
              </p>
              <p className="text-[var(--pub-text-secondary)]">
                We believe that aware communities are safer communities. By making it easy to share 
                and receive information, we help people make informed decisions about their daily lives.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[var(--pub-accent)]" />
                How We Work
              </h2>
              <p className="text-[var(--pub-text-secondary)]">
                All reports on NaborNet are community-submitted observations. They are not verified, 
                investigated, or endorsed by any authority. Think of it as a digital neighbourhood notice board.
              </p>
              <p className="text-[var(--pub-text-secondary)]">
                Reports are location-based and time-limited. Old reports automatically fade away, 
                keeping the focus on current activity.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--pub-text)] flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--pub-accent)]" />
                Our Principles
              </h2>
              <ul className="space-y-2 text-[var(--pub-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--pub-accent)] mt-1">•</span>
                  <span><strong>Privacy first:</strong> Anonymous reporting, minimal data collection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--pub-accent)] mt-1">•</span>
                  <span><strong>No authority claims:</strong> We don't verify or investigate reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--pub-accent)] mt-1">•</span>
                  <span><strong>Community-driven:</strong> The value comes from neighbours helping neighbours</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--pub-accent)] mt-1">•</span>
                  <span><strong>Calm tone:</strong> Information sharing, not panic or fear</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="text-center pt-4">
            <Link href="/safety">
              <Button className="border border-[var(--pub-border)] bg-transparent text-[var(--pub-text-secondary)] hover:bg-[var(--pub-surface)]">
                Read about Safety & Limitations
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
