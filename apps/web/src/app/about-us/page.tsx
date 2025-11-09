"use client";

import { LandingLayout } from "@/components/layout/LandingLayout";
import { AboutHero } from "@/components/about/about-hero";
import { AboutMission } from "@/components/about/about-mission";
import { AboutValues } from "@/components/about/about-values";
import { AboutStory } from "@/components/about/about-story";

export default function AboutPage() {
  return (
    <LandingLayout>
      <AboutHero />
      <AboutStory />
      <AboutMission />
      <AboutValues />
      {/* <AboutTeam /> */}
    </LandingLayout>
  );
}
