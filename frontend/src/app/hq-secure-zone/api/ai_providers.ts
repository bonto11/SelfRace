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
    const json = await callBackend<any>("/trigger/manual", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.NEXT_PUBLIC_MAINTENANCE_API_KEY ?? "",
      },
      body: JSON.stringify({ task: "list-ai-models" }),
    });

    const data = json?.data;
    if (!data) {
      throw new Error("Žiadne dáta z backendu");
    }

    return {
      openai: Array.isArray(data.openai) ? data.openai : [],
      gemini: Array.isArray(data.gemini) ? data.gemini : [],
      configured: data.configured || { openai: [], gemini: [] },
      errors: Array.isArray(data.errors) ? data.errors : [],
    };
  } catch (err: any) {
    console.error("[Admin API] apiFetchAiModels ERROR", err);
    throw new Error("Nepodarilo sa stiahnuť zoznam AI modelov.");
  }
}