import { Eye, EyeOff, Shield } from "lucide-react";
import Reveal from "@/components/public/Reveal";

const pillars = [
  {
    icon: Eye,
    title: "Structured Observations",
    description: "Signals, not comment threads.",
    delay: 0,
  },
  {
    icon: EyeOff,
    title: "Anonymous by Design",
    description: "No public profiles. No identity exposure.",
    delay: 100,
  },
  {
    icon: Shield,
    title: "Safety-Grade Defaults",
    description: "Guardrails that prioritise legality and calm awareness.",
    delay: 200,
  },
];

export default function TrustPillars() {
  return (
    <section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map((pillar) => (
          <Reveal key={pillar.title} delay={pillar.delay}>
            <div className="pub-glass rounded-xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center mb-4">
                <pillar.icon className="h-6 w-6 text-[var(--pub-accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--pub-text)] mb-2">{pillar.title}</h3>
              <p className="text-sm md:text-base text-[var(--pub-text-secondary)]">{pillar.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
