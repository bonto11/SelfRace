// src/app/shared/components/session/SectionRouteMatch.tsx
"use client";

import { useEffect, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { toast } from "@/app/shared/ui/components/Toast";
import {
  apiGetRouteMatchOptions,
  apiConfirmRouteMatch,
  apiRejectRouteAutoMatch,
  apiRemoveRouteMatch,
  type RouteMatchOptions,
} from "@/app/features/activities/api/activities_enrichment";
import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";

type Props = {
  activityId: number;
  onOpenComparison?: (routeName: string) => void;
};

const NEW_ROUTE_VALUE = "__new__";

export default function SectionRouteMatch({ activityId, onOpenComparison }: Props) {
  const { userId } = useUserId();
  const t = useT();

  const [options, setOptions] = useState<RouteMatchOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showAssignUI, setShowAssignUI] = useState(false);
  const [selectedName, setSelectedName] = useState<string>("");
  const [newName, setNewName] = useState("");

  const load = async () => {
    if (!userId || !activityId) return;
    setLoading(true);
    try {
      const out = await apiGetRouteMatchOptions(Number(userId), activityId);

      setOptions(out);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityId]);

  if (loading) return null;
  if (!options || !options.ok) return null;

  const { current_match, auto_match, existing_route_names } = options;

  const handleConfirm = async (routeName: string) => {
    if (!userId || !routeName.trim() || busy) return;
    setBusy(true);
    try {
      const out = await apiConfirmRouteMatch(Number(userId), activityId, routeName.trim());
      if (out.success) {
        toast.success(t("sessions.routeMatch.saved"));
        setShowAssignUI(false);
        setSelectedName("");
        setNewName("");
        await load();
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSuggestion = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await apiRejectRouteAutoMatch(Number(userId), activityId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await apiRemoveRouteMatch(Number(userId), activityId);
      toast.success(t("common.done") || "Uložené");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const selectOptions = [
    ...existing_route_names.map((n) => ({ value: n, label: n })),
    { value: NEW_ROUTE_VALUE, label: t("sessions.routeMatch.newRoute")},
  ];

  // --- Stav: potvrdená trasa ---
  if (current_match) {
    return (
      <ActivitySectionShell
        title={t("sessions.routeMatch.sectionTitle")}
        defaultOpen={false}
        items={[]}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-white/90">{current_match}</div>
          <div className="flex items-center gap-2">
            {onOpenComparison && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onOpenComparison(current_match)}
              >
                {t("sessions.routeMatch.compare")}
              </Button>
            )}
            <Button size="xs" variant="danger" disabled={busy} onClick={handleRemove}>
              {t("sessions.routeMatch.remove")}
            </Button>
          </div>
        </div>
      </ActivitySectionShell>
    );
  }

  // --- Stav: máme auto-match návrh, čaká na potvrdenie ---
  if (auto_match && !showAssignUI) {
    return (
      <ActivitySectionShell
        title={t("sessions.routeMatch.sectionTitle")}
        defaultOpen={true}
        items={[]}
      >
        <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2">
          <div className="text-sm text-white/80">
            {(t("sessions.routeMatch.suggestionText")).replace(
              "{{name}}",
              auto_match,
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="primary"
              disabled={busy}
              onClick={() => handleConfirm(auto_match)}
            >
              {t("sessions.routeMatch.confirm")}
            </Button>
            <Button size="xs" variant="ghost" disabled={busy} onClick={handleRejectSuggestion}>
              {t("common.cancel")}
            </Button>
            <Button
              size="xs"
              variant="secondary"
              className="ml-auto"
              onClick={() => setShowAssignUI(true)}
            >
              {t("sessions.routeMatch.chooseOther")}
            </Button>
          </div>
        </div>
      </ActivitySectionShell>
    );
  }

  // --- Stav: bez návrhu, alebo user chce vybrať manuálne ---
  return (
    <ActivitySectionShell
      title={t("sessions.routeMatch.sectionTitle")}
      defaultOpen={false}
      items={[]}
    >
      {!showAssignUI ? (
        <Button size="xs" variant="secondary" onClick={() => setShowAssignUI(true)}>
          {t("sessions.routeMatch.assign")}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <SelectField
            value={selectedName}
            onChange={(e) => setSelectedName(String(e.target.value))}
            options={[{ value: "", label: t("sessions.routeMatch.selectPlaceholder") }, ...selectOptions]}
            variant="editable"
          />

          {selectedName === NEW_ROUTE_VALUE && (
            <input
              type="text"
              className="w-full rounded bg-white/5 border border-white/10 p-2 text-sm text-white focus:border-white/30 focus:outline-none"
              placeholder={t("sessions.routeMatch.newRouteNamePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setShowAssignUI(false);
                setSelectedName("");
                setNewName("");
              }}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="xs"
              disabled={
                busy ||
                !selectedName ||
                (selectedName === NEW_ROUTE_VALUE && !newName.trim())
              }
              onClick={() =>
                handleConfirm(selectedName === NEW_ROUTE_VALUE ? newName : selectedName)
              }
            >
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </ActivitySectionShell>
  );
}