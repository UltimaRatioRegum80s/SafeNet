import { ShieldCheck } from "lucide-react";
import Reveal from "@/components/public/Reveal";

const items = [
  "Not an emergency service",
  "No chat or free-text speculation",
  "Consent + terms tracked",
  "Conservative reporting controls",
];

export default function Guardrails() {
  return (
    <section>
      <Reveal>
        <div className="pub-glass rounded-xl p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--pub-text)] mb-2">
            Built With Guardrails.
          </h2>
          <p className="text-sm md:text-base text-[var(--pub-text-secondary)] mb-6">
            Responsible design decisions baked into every layer of the platform.
          </p>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[var(--pub-accent)] shrink-0" />
                <span className="text-sm md:text-base text-[var(--pub-text)]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
