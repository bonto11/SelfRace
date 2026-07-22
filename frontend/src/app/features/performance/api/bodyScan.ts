// src/features/performance/api/bodyScan.ts

import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  BodyScan,
  BodyScanUploadResult,
  BodyScanApiSuccess,
  BodyScanApiFail,
} from "@/app/features/performance/types/bodyScan";

/**
 * POST /body-scan/:user_id/upload
 * - multipart/form-data upload fotky, vráti draft (nepotvrdený) extrahovaný scan
 */
export async function apiUploadBodyScan(
  userId: number,
  file: File,
): Promise<BodyScanUploadResult | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/body-scan/${encodeURIComponent(String(userId))}/upload`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    type ResponseShape =
      | BodyScanApiSuccess<BodyScanUploadResult>
      | BodyScanApiFail
      | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "POST",
      cache: "no-store",
      body: formData,
    });

    if (!json || json.success === false) {
      return null;
    }

    return json.data ?? null;
  } catch (e) {
    console.error("[BODYSCAN][apiUploadBodyScan] ERROR", e);
    return null;
  }
}

/**
 * POST /body-scan/:user_id/:scan_id/confirm
 * - potvrdí draft scan (voliteľne s opravami pred potvrdením)
 */
export async function apiConfirmBodyScan(
  userId: number,
  scanId: number,
  corrections?: Partial<BodyScan>,
): Promise<BodyScan | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/body-scan/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(scanId),
  )}/confirm`;

  try {
    type ResponseShape = BodyScanApiSuccess<{ scan: BodyScan }> | BodyScanApiFail | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrections: corrections ?? null }),
    });

    if (!json || json.success === false) {
      return null;
    }

    return json.data.scan ?? null;
  } catch (e) {
    console.error("[BODYSCAN][apiConfirmBodyScan] ERROR", e);
    return null;
  }
}

/**
 * PATCH /body-scan/:user_id/:scan_id
 * - ručná úprava ľubovoľných polí (aj po potvrdení)
 */
export async function apiEditBodyScan(
  userId: number,
  scanId: number,
  fields: Partial<BodyScan>,
): Promise<BodyScan | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/body-scan/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(scanId),
  )}`;

  try {
    type ResponseShape = BodyScanApiSuccess<{ scan: BodyScan }> | BodyScanApiFail | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    if (!json || json.success === false) {
      return null;
    }

    return json.data.scan ?? null;
  } catch (e) {
    console.error("[BODYSCAN][apiEditBodyScan] ERROR", e);
    return null;
  }
}

/**
 * GET /body-scan/:user_id/latest
 */
export async function apiGetLatestBodyScan(
  userId: number,
): Promise<BodyScan | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/body-scan/${encodeURIComponent(String(userId))}/latest`;

  try {
    type ResponseShape = BodyScanApiSuccess<BodyScan> | BodyScanApiFail | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json || json.success === false) {
      return null;
    }

    return json.data ?? null;
  } catch (e) {
    console.error("[BODYSCAN][apiGetLatestBodyScan] ERROR", e);
    return null;
  }
}

/**
 * GET /body-scan/:user_id?start_date=&end_date=
 * - zoznam potvrdených scanov pre trend graf, zoradené vzostupne
 */
export async function apiGetBodyScansForTrend(
  userId: number,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<BodyScan[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const params = new URLSearchParams();
  if (opts.startDate) params.set("start_date", opts.startDate);
  if (opts.endDate) params.set("end_date", opts.endDate);

  const path = `/body-scan/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  try {
    type ResponseShape = BodyScanApiSuccess<BodyScan[]> | BodyScanApiFail | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json || json.success === false) {
      return [];
    }

    return json.data ?? [];
  } catch (e) {
    console.error("[BODYSCAN][apiGetBodyScansForTrend] ERROR", e);
    return [];
  }
}

/**
 * DELETE /body-scan/:user_id/:scan_id
 */
export async function apiDeleteBodyScan(
  userId: number,
  scanId: number,
): Promise<boolean> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/body-scan/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(scanId),
  )}`;

  try {
    type ResponseShape = BodyScanApiSuccess<any> | BodyScanApiFail | null;

    const json = await callBackend<ResponseShape>(path, {
      method: "DELETE",
      cache: "no-store",
    });

    return !!json && json.success === true;
  } catch (e) {
    console.error("[BODYSCAN][apiDeleteBodyScan] ERROR", e);
    return false;
  }
}