import { Shield, AlertTriangle } from "lucide-react";
import Reveal from "@/components/public/Reveal";

const isItems = [
  "A community-driven platform for sharing observations",
  "A way to stay aware of what's happening nearby",
  "Anonymous reporting with no personal data required",
  "A simple neighbourhood tool for local awareness",
];

const isNotItems = [
  "NOT an emergency service — in an emergency, contact local emergency services",
  "NOT a substitute for police or security services",
  "NOT a source of verified or official information",
  "NOT an authority or governance tool",
];

export default function WhatItIsSplit() {
  return (
    <section>
      <Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="pub-glass rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[var(--pub-text)] mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--pub-accent)]" />
              What NaborNet is
            </h2>
            <ul className="space-y-3">
              {isItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[var(--pub-text-secondary)]">
                  <span className="text-[var(--pub-accent)] mt-1">•</span>
                  <span className="text-sm md:text-base">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pub-glass rounded-xl p-6 shadow-sm" style={{ borderColor: 'rgba(200, 169, 81, 0.3)' }}>
            <h2 className="text-xl font-semibold text-[var(--pub-text)] mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--pub-gold)]" />
              What NaborNet is NOT
            </h2>
            <ul className="space-y-3">
              {isNotItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[var(--pub-text-secondary)]">
                  <span className="text-[var(--pub-gold)] mt-1">•</span>
                  <span className="text-sm md:text-base">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
