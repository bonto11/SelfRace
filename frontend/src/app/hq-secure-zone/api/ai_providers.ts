import { callBackend } from "@/app/shared/utils/callBackend";

export interface AiModelsData {
  openai: string[];
  gemini: string[];
  errors: string[];
}

export async function apiFetchAiModels(): Promise<AiModelsData> {
  // callBackend sa postará o base URL aj o pripojenie Auth hlavičiek (užívateľského tokenu)
  // Backend si overí, či je to ADMIN.
  try {
    const json = await callBackend<AiModelsData>("/maintenance/ai-models", {
      method: "GET",
      cache: "no-store",
    });

    if (!json) {
      throw new Error("Žiadne dáta z backendu");
    }

    return {
      openai: Array.isArray(json.openai) ? json.openai : [],
      gemini: Array.isArray(json.gemini) ? json.gemini : [],
      errors: Array.isArray(json.errors) ? json.errors : [],
    };
  } catch (err: any) {
    console.error("[Admin API] apiFetchAiModels ERROR", err);
    throw new Error("Nepodarilo sa stiahnuť zoznam AI modelov.");
  }
}