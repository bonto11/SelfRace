// src/features/coach/components/prefs/SportsSection.tsx
"use client";

import { useState, useMemo } from "react";
import Button from "@/shared/components/ui/Button";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SURFACE_INLINE, SECTION } from "@/shared/ui/classes";
import type { SportKind } from "@/features/prefs/types/prefs";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

const ALL_SPORTS: SportKind[] = ["run", "ride", "strength", "swim"];

type SecondaryRole = "none" | "supplement" | "improve";

type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  /** stále existuje kvôli kompatibilite, ale nastavuje sa podľa priority */
  share_pct: number;
};

type Props = {
  local: any;
  mainSport: SportKind | "";
  secondary: SecondaryMix[];
  shareWarn: boolean; // nepoužívame, ale nechávame kvôli kompatibilite
  setPref: (key: any, value: any) => void;
  updateSecondary: (sport: SportKind, patch: Partial<SecondaryMix>) => void;
};

/** Priority: 1. = main_sport, ostatné 2nd / 3rd / 4th */
type Priority = "none" | "second" | "third" | "fourth";

const priorityFromShare = (share: number | undefined | null): Priority => {
  if (!share || share <= 0) return "none";
  if (share >= 55) return "second";
  if (share >= 30) return "third";
  return "fourth";
};

const shareFromPriority = (p: Priority): number => {
  if (p === "second") return 60;
  if (p === "third") return 30;
  if (p === "fourth") return 15;
  return 0;
};

const priorityLabel = (p: Priority) => {
  switch (p) {
    case "second":
      return "2nd";
    case "third":
      return "3rd";
    case "fourth":
      return "4th";
    default:
      return "—";
  }
};

export function SportsSection({
  local,
  mainSport,
  secondary,
  shareWarn: _shareWarn, // eslint-disable-line @typescript-eslint/no-unused-vars
  setPref,
  updateSecondary,
}: Props) {
  const [open, setOpen] = useState(false);

  // ---------- closed preview ----------
  const preview = useMemo(() => {
    const main = mainSport || "— none —";

    const secBrief = secondary
      .map((s) => {
        const pr = priorityFromShare(s.share_pct);
        if (pr === "none" && s.role === "none") return null;
        const prTxt = priorityLabel(pr);
        return `${s.sport} [${prTxt}, ${s.role}]`;
      })
      .filter(Boolean) as string[];

    const secText = secBrief.length ? secBrief.join(", ") : "none";

    return {
      mainText: `Main: ${main}`,
      secText: `Others: ${secText}`,
    };
  }, [mainSport, secondary]);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Sports</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Vyber hlavný šport. Ostatným nastav dôležitosť (2nd / 3rd / 4th) a rolu (supplement / improve). 'none' znamená, že coach tento šport neplánuje." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse sports"
            labelWhenClosed="Expand sports"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs select-none opacity-80",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{preview.mainText}</span>
            <span>{preview.secText}</span>
          </div>
        </div>
      )}

      {/* Body */}
      {open && (
        <div className="space-y-3">
          {/* Main sport */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <div className="text-xs opacity-80 mb-1">Main sport</div>
              <SelectField
                value={mainSport}
                onChange={(e) => {
                  const v = e.target.value as SportKind | "";
                  setPref("main_sport", v === "" ? null : (v as SportKind));

                  // odstráň main_sport zo secondary_mix
                  const filtered = (local.secondary_mix ?? []).filter(
                    (s: any) => s.sport !== v
                  );
                  setPref("secondary_mix", filtered as any);
                }}
                options={[
                  { value: "", label: "— none —" },
                  ...ALL_SPORTS.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>

            <div className="sm:col-span-2 text-xs opacity-70 flex items-end">
              Ak používaš len beh, ostatné nechaj na &quot;none&quot;. Pri ride
              / swim nastav prioritu (2nd / 3rd / 4th) a rolu podľa toho, ako
              veľmi ich chceš mať v pláne.
            </div>
          </div>

          {/* Secondary rows */}
          <div className="grid grid-cols-1 gap-2">
            {secondary.map((sec) => {
              const pr = priorityFromShare(sec.share_pct);
              const isOff = pr === "none" && sec.role === "none";

              return (
                <div
                  key={sec.sport}
                  className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-[80px] text-sm font-medium">
                      {sec.sport}
                    </div>

                    {/* priority buttons */}
                    <div className="inline-flex items-center gap-1">
                      {(["none", "second", "third", "fourth"] as const).map(
                        (p) => {
                          const active = pr === p;
                          const label = priorityLabel(p);
                          return (
                            <Button
                              key={p}
                              type="button"
                              size="xs"
                              variant="prefs"
                              active={active}
                              onClick={() => {
                                const newShare = shareFromPriority(p);
                                updateSecondary(sec.sport, {
                                  share_pct: newShare,
                                });
                              }}
                              title={label}
                            >
                              {label}
                            </Button>
                          );
                        }
                      )}
                    </div>

                    {/* role buttons */}
                    <div className="inline-flex items-center gap-1">
                      {(["none", "supplement", "improve"] as const).map((r) => {
                        const active = sec.role === r;
                        return (
                          <Button
                            key={r}
                            type="button"
                            size="xs"
                            variant="prefs"
                            active={active}
                            onClick={() => {
                              if (r === "none") {
                                // úplne vypni šport
                                updateSecondary(sec.sport, {
                                  role: "none",
                                  share_pct: 0,
                                });
                              } else {
                                // keď zapíname rolu a share je nula -> daj default 4th
                                const currPr = priorityFromShare(sec.share_pct);
                                const newShare =
                                  currPr === "none"
                                    ? shareFromPriority("fourth")
                                    : sec.share_pct;
                                updateSecondary(sec.sport, {
                                  role: r,
                                  share_pct: newShare,
                                });
                              }
                            }}
                            title={r}
                          >
                            {r}
                          </Button>
                        );
                      })}
                    </div>

                    {isOff && (
                      <div className="text-[10px] opacity-60 sm:ml-auto">
                        This sport is currently ignored in planning (role:
                        none).
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
