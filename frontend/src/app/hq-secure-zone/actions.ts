"use server";

import { getSupabaseServer } from "@/app/shared/utils/supabaseServer"; // Použi vašu funkciu pre server
import { revalidatePath } from "next/cache";

export async function updateMaintenanceMode(active: boolean, msgSk: string, msgEn: string) {
  const supabase = await getSupabaseServer();

  // 1. DVOJITÁ OCHRANA: Aj keď Layout chráni stránku, serverová akcia 
  // si MUSÍ sama overiť, kto ju volá. (Defense in depth)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Neautorizovaný prístup");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_uid", user.id)
    .single();

  if (profile?.role !== "ADMIN") {
    throw new Error("Zakázané: Nemáte práva administrátora");
  }

  // 2. Formátovanie dát pre JSONB stĺpec
  const newValue = {
    active: active,
    message: {
      sk: msgSk,
      en: msgEn
    }
  };

  // 3. Update v databáze
  const { error } = await supabase
    .from("app_settings")
    .update({ value: newValue })
    .eq("key", "maintenance_mode");

  if (error) throw new Error(`Chyba databázy: ${error.message}`);

  // 4. Povieme Next.js, aby vymazal cache a prejavilo sa to okamžite
  revalidatePath("/", "layout"); 
  
  return { success: true };
}