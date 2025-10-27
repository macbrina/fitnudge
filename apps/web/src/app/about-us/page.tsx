"use client";

import { Layout } from "@/components/layout/layout";
import { AboutHero } from "@/components/about/about-hero";
import { AboutMission } from "@/components/about/about-mission";
import { AboutTeam } from "@/components/about/about-team";
import { AboutValues } from "@/components/about/about-values";
import { AboutStory } from "@/components/about/about-story";

export default function AboutPage() {
  return (
    <Layout>
      <AboutHero />
      <AboutStory />
      <AboutMission />
      <AboutValues />
      {/* <AboutTeam /> */}
    </Layout>
  );
}
