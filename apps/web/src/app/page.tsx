"use client";

import { LandingLayout } from "@/components/layout/LandingLayout";
import { Hero } from "@/components/landing/hero";
import { Wellness } from "@/components/landing/wellness";
import { Features } from "@/components/landing/features";
import { Tracker } from "@/components/landing/tracker";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Waitlist } from "@/components/landing/waitlist";

export default function HomePage() {
  return (
    <LandingLayout>
      <Hero />
      <Wellness />
      <Features />
      <Tracker />
      <HowItWorks />
      <Waitlist />
    </LandingLayout>
  );
}
