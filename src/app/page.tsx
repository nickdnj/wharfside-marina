import { Hero } from "@/components/site/Hero";
import { ActionCards } from "@/components/site/ActionCards";
import { QuickInfo } from "@/components/site/QuickInfo";
import { TideEmbed } from "@/components/site/TideEmbed";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ActionCards />
      <QuickInfo />
      <TideEmbed />
    </>
  );
}
