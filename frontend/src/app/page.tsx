// src/app/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { guessUiLang, type UiLang } from "@/app/shared/i18n/locale";
import { sk } from "@/app/shared/i18n/locales/sk";
import { cs } from "@/app/shared/i18n/locales/cs";
import { en } from "@/app/shared/i18n/locales/en";
import LandingPage from "@/app/features/landing/components/LandingPage";

const DICT = { sk, cs, en } as const;

// Jazyk návštevníka z Accept-Language – landing aj náhľad odkazu sú hneď v jeho jazyku.
async function requestLang(): Promise<UiLang> {
  const h = await headers();
  return guessUiLang(h.get("accept-language"));
}

export async function generateMetadata(): Promise<Metadata> {
  const meta = DICT[await requestLang()].landing.meta;
  return {
    title: meta.title,
    description: meta.description,
    openGraph: { title: meta.title, description: meta.description, images: ["/landing/pair.webp"] },
  };
}

export default async function Page() {
  return <LandingPage initialLang={await requestLang()} />;
}
