// src/app/features/account/api/accountDelete.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { AccountDeleteStatus } from "@/app/features/account/types/account";

async function handleAccountDeleteCall(
  path: string,
  init: RequestInit,
  defaultMsg: string,
): Promise<AccountDeleteStatus> {
  console.debug("[AccountDelete] ->", path, init.method);

  try {
    const json = await callBackend<
      AccountDeleteStatus & { detail?: string }
    >(path, {
      cache: "no-store",
      ...init,
    });

    return {
      pending: !!json.pending,
      delete_at:
        typeof json.delete_at === "string" ? json.delete_at : null,
    };
  } catch (e: any) {
    console.error("[AccountDelete] ERROR", e);
    const msg =
      e instanceof Error ? e.message : defaultMsg;
    throw new Error(msg);
  }
}

export async function apiGetAccountDeleteStatus(
  userId: number,
): Promise<AccountDeleteStatus> {
  if (!userId) {
    throw new Error("Missing userId in apiGetAccountDeleteStatus");
  }

  const path = `/account/${encodeURIComponent(String(userId))}/delete/status`;
  return handleAccountDeleteCall(
    path,
    { method: "GET" },
    "Nepodarilo sa načítať stav vymazania účtu.",
  );
}

export async function apiRequestAccountDelete(
  userId: number,
): Promise<AccountDeleteStatus> {
  if (!userId) {
    throw new Error("Missing userId in apiRequestAccountDelete");
  }

  const path = `/account/${encodeURIComponent(String(userId))}/delete/request`;
  return handleAccountDeleteCall(
    path,
    { method: "POST" },
    "Nepodarilo sa označiť účet na vymazanie.",
  );
}

export async function apiCancelAccountDelete(
  userId: number,
): Promise<AccountDeleteStatus> {
  if (!userId) {
    throw new Error("Missing userId in apiCancelAccountDelete");
  }

  const path = `/account/${encodeURIComponent(String(userId))}/delete/cancel`;
  return handleAccountDeleteCall(
    path,
    { method: "POST" },
    "Nepodarilo sa zrušiť vymazanie účtu.",
  );
}