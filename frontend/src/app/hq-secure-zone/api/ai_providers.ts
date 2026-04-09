import { callBackend } from "@/app/shared/utils/callBackend";

export interface AiModelsData {
  openai: string[];
  gemini: string[];
  configured: {
    openai: string[];
    gemini: string[];
  };
  errors: string[];
}

export async function apiFetchAiModels(): Promise<AiModelsData> {
  try {
    const json = await callBackend<any>("/maintenance/ai-models", {
      method: "GET",
      cache: "no-store",
    });

    if (!json) {
      throw new Error("Žiadne dáta z backendu");
    }

    return {
      openai: Array.isArray(json.openai) ? json.openai : [],
      gemini: Array.isArray(json.gemini) ? json.gemini : [],
      configured: json.configured || { openai: [], gemini: [] },
      errors: Array.isArray(json.errors) ? json.errors : [],
    };
  } catch (err: any) {
    console.error("[Admin API] apiFetchAiModels ERROR", err);
    throw new Error("Nepodarilo sa stiahnuť zoznam AI modelov.");
  }
}