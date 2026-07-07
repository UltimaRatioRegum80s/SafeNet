import { WifiOff } from "lucide-react";
import Reveal from "@/components/public/Reveal";

export default function OfflineReady() {
  return (
    <section>
      <Reveal>
        <div className="pub-glass rounded-xl p-6 md:p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--pub-accent)]/10 flex items-center justify-center mx-auto mb-5">
            <WifiOff className="h-7 w-7 text-[var(--pub-accent)]" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--pub-text)] mb-3">
            Works When Networks Don't.
          </h2>
          <p className="text-sm md:text-base text-[var(--pub-text-secondary)] max-w-lg mx-auto">
            Draft reports offline. They sync automatically when you reconnect. No data lost.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
