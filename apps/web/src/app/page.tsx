"use client";

import { Layout } from "@/components/layout/layout";
import { Hero } from "@/components/landing/hero";
import { Wellness } from "@/components/landing/wellness";
import { Features } from "@/components/landing/features";
import { Tracker } from "@/components/landing/tracker";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Download } from "@/components/landing/download";

export default function HomePage() {
  return (
    <Layout>
      <Hero />
      <Wellness />
      <Features />
      <Tracker />
      <HowItWorks />
      <Download />
    </Layout>
  );
}
