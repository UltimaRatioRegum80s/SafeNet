import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Reveal from "@/components/public/Reveal";

export default function BetaAccess() {
  return (
    <section>
      <Reveal>
        <div className="pub-glass rounded-xl p-6 md:p-8 shadow-sm text-center" style={{ borderColor: 'rgba(200, 169, 81, 0.3)' }}>
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--pub-gold)] mb-3">
            Closed Beta
          </h2>
          <p className="text-sm md:text-base text-[var(--pub-text-secondary)] max-w-lg mx-auto mb-6">
            Registration is limited to invited users while we evaluate safety and usability.
          </p>
          <a href="mailto:nabornetinfo@gmail.com">
            <Button
              variant="outline"
              className="border-[var(--pub-gold)]/30 text-[var(--pub-gold)] hover:bg-[var(--pub-gold)]/10"
            >
              <Mail className="mr-2 h-4 w-4" />
              Contact the team
            </Button>
          </a>
        </div>
      </Reveal>
    </section>
  );
}
