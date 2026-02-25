"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";

import {
  apiGetAccountDeleteStatus,
  apiRequestAccountDelete,
  apiCancelAccountDelete,
} from "@/app/features/settings/api/account";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";

import type { AccountDeleteStatus } from "@/app/features/settings/types/account";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  FORM_GRID_SPLIT,
  PANEL_STACK,
  INPUTS_CARD_BODY,
} from "@/app/shared/ui/tokens";

type DeleteModalKind = "request" | "cancel" | null;
type DeleteState = "none" | "pending" | "cancelled" | "deleted";

function getDeleteState(st: AccountDeleteStatus | null): DeleteState {
  const anySt = st as any;
  const status = (anySt?.status as DeleteState | undefined) ?? undefined;
  if (status) return status;
  if (anySt?.hard_deleted_at) return "deleted";
  if (anySt?.cancelled_at) return "cancelled";
  if (anySt?.pending || anySt?.delete_at) return "pending";
  return "none";
}

export default function AccountPanel() {
  const router = useRouter();
  const { userId } = useUserId();
  const t = useT();

  const [open, setOpen] = useState(false); // Štandardne zbalené
  const [deleteStatus, setDeleteStatus] = useState<AccountDeleteStatus | null>(
    null,
  );
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalKind>(null);
  const [deleteConsentChecked, setDeleteConsentChecked] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoadingDelete(true);
    apiGetAccountDeleteStatus(userId)
      .then((st) => {
        if (!alive) return;
        setDeleteStatus(st);
      })
      .catch((e) => console.error("[AccountPanel] delete status error", e))
      .finally(() => {
        if (alive) setLoadingDelete(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  function closeDeleteModal() {
    setDeleteModal(null);
    setDeleteConsentChecked(false);
  }

  async function confirmRequestDelete() {
    if (!userId || processingDelete) return;
    if (!deleteConsentChecked) {
      toast.error(t("accountDelete.modal.errorCheckbox"));
      return;
    }
    setProcessingDelete(true);
    try {
      const st = await apiRequestAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success(t("accountDelete.toasts.requestSuccess"));
    } catch (e: any) {
      toast.error(t(e?.message) || t("api.account.requestFailed"));
    } finally {
      setProcessingDelete(false);
    }
  }

  async function confirmCancelDelete() {
    if (!userId || processingDelete) return;
    if (!deleteConsentChecked) {
      toast.error(t("accountDelete.modal.errorCheckbox"));
      return;
    }
    setProcessingDelete(true);
    try {
      const st = await apiCancelAccountDelete(userId);
      setDeleteStatus(st);
      closeDeleteModal();
      toast.success(t("accountDelete.toasts.cancelSuccess"));
    } catch (e: any) {
      toast.error(t(e?.message) || t("api.account.cancelFailed"));
    } finally {
      setProcessingDelete(false);
    }
  }

  const deleteState = getDeleteState(deleteStatus);
  const deletePending = deleteState === "pending";
  const deleteCancelled = deleteState === "cancelled";
  const busyAny = processingDelete;

  const deleteAtLabel =
    deleteStatus?.delete_at &&
    (() => {
      try {
        return new Date(deleteStatus.delete_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return deleteStatus.delete_at as any;
      }
    })();

  const previewText = loadingDelete
    ? t("settings.preview.deleteLoading")
    : deleteState === "pending"
      ? `${t("settings.preview.deletePending")}: ${deleteAtLabel ?? "pending"}`
      : deleteState === "cancelled"
        ? t("settings.preview.deleteCancelled")
        : t("settings.preview.deleteNone");

  return (
    <>
      <InputsCard
        title={t("settings.actions")}
        subtitle={t("settings.quickActions")}
        preview={previewText}
        open={open}
        onOpenChange={setOpen}
        backdropVariant="default"
      >
        <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
          <div className={FORM_GRID_SPLIT}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push("/forgot-password")}
              disabled={!userId}
            >
              {t("settings.btnChangePassword")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => router.push("/profile")}
              disabled={!userId}
            >
              {t("settings.btnChangeMail")}
            </Button>
          </div>

          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: appColors.divider }}
          >
            <div
              className="text-sm font-semibold"
              style={{ color: appColors.statusError }}
            >
              {t("accountDelete.title")}
            </div>

            <div
              className="mt-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: deleteCancelled
                  ? "rgba(148,163,184,0.35)"
                  : "rgba(239,68,68,0.55)",
                background: deleteCancelled
                  ? "rgba(30,41,59,0.35)"
                  : "rgba(127,29,29,0.35)",
                color: appColors.textPrimary,
              }}
            >
              {loadingDelete ? (
                <p style={{ color: appColors.textMuted }}>
                  {t("accountDelete.checkingStatus")}
                </p>
              ) : deletePending ? (
                <>
                  <p>
                    {t("accountDelete.status.accountIs")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.pendingLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.pendingDesc")}
                    {deleteAtLabel ? (
                      <>
                        {" "}
                        {t("accountDelete.status.estimatedDate")}{" "}
                        <span
                          className="font-semibold"
                          style={{ color: appColors.textPrimary }}
                        >
                          {deleteAtLabel}
                        </span>
                        .
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                </>
              ) : deleteCancelled ? (
                <>
                  <p>
                    {t("accountDelete.status.plannedDeletionWas")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.cancelledLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.cancelledDesc")}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {t("accountDelete.status.deletionIs")}{" "}
                    <span className="font-semibold">
                      {t("accountDelete.status.defaultLabel")}
                    </span>
                    .
                  </p>
                  <p className="mt-1" style={{ color: appColors.textMuted }}>
                    {t("accountDelete.status.defaultDesc")}
                  </p>
                </>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {deletePending ? (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={busyAny || !userId}
                  onClick={() => {
                    setDeleteConsentChecked(false);
                    setDeleteModal("cancel");
                  }}
                >
                  {t("accountDelete.buttons.cancelDelete")}
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant={"danger" as any}
                  disabled={busyAny || !userId}
                  onClick={() => {
                    setDeleteConsentChecked(false);
                    setDeleteModal("request");
                  }}
                >
                  {t("accountDelete.buttons.requestDelete")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </InputsCard>

      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border p-4"
            style={{
              background: appColors.surfaceCard,
              borderColor: "rgba(239, 68, 68, 0.35)",
              color: appColors.textPrimary,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-base font-semibold"
                  style={{ color: "rgba(254, 202, 202, 0.95)" }}
                >
                  {deleteModal === "request"
                    ? t("accountDelete.modal.titleRequest")
                    : t("accountDelete.modal.titleCancel")}
                </div>
                <div
                  className="text-[12px] mt-1"
                  style={{ color: appColors.textMuted }}
                >
                  {deleteModal === "request"
                    ? t("accountDelete.modal.subtitleRequest")
                    : t("accountDelete.modal.subtitleCancel")}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                className="text-xl leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>

            <div
              className="mt-3 text-sm"
              style={{ color: appColors.textMuted }}
            >
              {deleteModal === "request" ? (
                <>
                  {t("accountDelete.modal.infoRequest")}
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>{t("accountDelete.modal.bullets.b1")}</li>
                    <li>{t("accountDelete.modal.bullets.b2")}</li>
                    <li>{t("accountDelete.modal.bullets.b3")}</li>
                  </ul>
                </>
              ) : (
                t("accountDelete.modal.infoCancel")
              )}
            </div>

            <div className="mt-4">
              <Checkbox
                checked={deleteConsentChecked}
                onChange={(e) =>
                  setDeleteConsentChecked(e.currentTarget.checked)
                }
                label={
                  <span className="text-sm">
                    {deleteModal === "request"
                      ? t("accountDelete.modal.consentRequest")
                      : t("accountDelete.modal.consentCancel")}
                  </span>
                }
                hint={
                  <span className="text-[11px]">
                    {t("accountDelete.modal.consentHint")}
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={closeDeleteModal}
                disabled={processingDelete}
              >
                {t("accountDelete.modal.btnCancel")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!deleteConsentChecked || processingDelete}
                onClick={
                  deleteModal === "request"
                    ? confirmRequestDelete
                    : confirmCancelDelete
                }
              >
                {processingDelete ? (
                  <LoadingSpinner size="button" />
                ) : deleteModal === "request" ? (
                  t("accountDelete.buttons.requestDelete")
                ) : (
                  t("accountDelete.buttons.cancelDelete")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
