import { MapPin, Users, Shield } from "lucide-react";
import Reveal from "@/components/public/Reveal";

const steps = [
  {
    number: 1,
    icon: MapPin,
    title: "See what's nearby",
    description: "View observations from your neighbourhood on the map or feed.",
    delay: 0,
  },
  {
    number: 2,
    icon: Users,
    title: "Share observations",
    description: "Report what you see to help your neighbours stay informed.",
    delay: 100,
  },
  {
    number: 3,
    icon: Shield,
    title: "Stay aware",
    description: "Get a general sense of activity in your area. Use your judgement.",
    delay: 200,
  },
];

export default function HowItWorksSteps() {
  return (
    <section id="how-it-works">
      <Reveal>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--pub-text)] text-center mb-10">
          How it works
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {steps.map((step) => (
          <Reveal key={step.number} delay={step.delay}>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center mx-auto">
                <step.icon className="h-6 w-6 text-[var(--pub-accent)]" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-[var(--pub-text)]">
                {step.number}. {step.title}
              </h3>
              <p className="text-sm md:text-base text-[var(--pub-text-secondary)]">{step.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
