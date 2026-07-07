import { useQuery } from "@tanstack/react-query";
import PublicLayout from "@/components/public/PublicLayout";
import Hero from "@/components/public/sections/Hero";
import TrustPillars from "@/components/public/sections/TrustPillars";
import WhatItIsSplit from "@/components/public/sections/WhatItIsSplit";
import HowItWorksSteps from "@/components/public/sections/HowItWorksSteps";
import Guardrails from "@/components/public/sections/Guardrails";
import OfflineReady from "@/components/public/sections/OfflineReady";
import BetaAccess from "@/components/public/sections/BetaAccess";
import ParallaxSection from "@/components/public/ParallaxSection";
import type { LandingBackground } from "@shared/schema";

export default function Landing() {
  const { data: backgrounds = [] } = useQuery<LandingBackground[]>({
    queryKey: ['/api/landing-backgrounds'],
    staleTime: 60_000,
  });

  const bgFor = (sectionId: string) => {
    const bg = backgrounds.find(b => b.sectionId === sectionId);
    return bg?.imageUrl;
  };

  return (
    <PublicLayout>
      <Hero bgImage={bgFor('hero')} />
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 20% 50%, rgba(61,160,207,0.06) 0%, transparent 60%)"
        bgImage={bgFor('trust_pillars')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <TrustPillars />
        </div>
      </ParallaxSection>
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 80% 50%, rgba(61,160,207,0.04) 0%, transparent 50%)"
        bgImage={bgFor('what_it_is')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <WhatItIsSplit />
        </div>
      </ParallaxSection>
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 30% 40%, rgba(61,160,207,0.05) 0%, transparent 55%)"
        bgImage={bgFor('how_it_works')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <HowItWorksSteps />
        </div>
      </ParallaxSection>
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 70% 60%, rgba(61,160,207,0.04) 0%, transparent 50%)"
        bgImage={bgFor('guardrails')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <Guardrails />
        </div>
      </ParallaxSection>
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 50% 50%, rgba(61,160,207,0.06) 0%, transparent 55%)"
        bgImage={bgFor('offline_ready')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <OfflineReady />
        </div>
      </ParallaxSection>
      <ParallaxSection
        bgGradient="radial-gradient(ellipse at 40% 50%, rgba(200,169,81,0.04) 0%, transparent 50%)"
        bgImage={bgFor('beta_access')}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <BetaAccess />
        </div>
      </ParallaxSection>
    </PublicLayout>
  );
}
