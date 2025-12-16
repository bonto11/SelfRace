// src/features/coach/components/prefs/SportsSection.tsx
"use client";

import { useState, useMemo } from "react";
import Button from "@/shared/components/ui/Button";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SURFACE_INLINE, SECTION } from "@/shared/ui/classes";
import type { SportKind } from "@/features/coach/types/prefsTypes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

const ALL_SPORTS: SportKind[] = ["run", "ride", "strength", "swim"];

type SecondaryRole = "none" | "supplement" | "improve";

type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  /** stále existuje kvôli kompatibilite, ale nastavujeme ho podľa priority */
  share_pct: number;
};

type Props = {
  local: any;
  mainSport: SportKind | "";
  secondary: SecondaryMix[];
  /** shareWarn síce posielame z rodiča, ale už ho nepoužívame vizuálne */
  shareWarn: boolean;
  setPref: (key: any, value: any) => void;
  updateSecondary: (sport: SportKind, patch: Partial<SecondaryMix>) => void;
};

/* Helpery: mapujeme priority <-> share_pct
   - none      -> 0 %
   - secondary -> 60 %
   - tertiary  -> 30 %
*/
type Priority = "none" | "secondary" | "tertiary";

const priorityFromShare = (share: number | undefined | null): Priority => {
  if (!share || share <= 0) return "none";
  if (share >= 45) return "secondary";
  return "tertiary";
};

const shareFromPriority = (p: Priority): number => {
  if (p === "secondary") return 60;
  if (p === "tertiary") return 30;
  return 0;
};

export function SportsSection({
  local,
  mainSport,
  secondary,
  shareWarn, // eslint-disable-line @typescript-eslint/no-unused-vars
  setPref,
  updateSecondary,
}: Props) {
  const [open, setOpen] = useState(false);

  // ---------- closed preview ----------
  const preview = useMemo(() => {
    const main = mainSport || "— none —";

    const secBrief = secondary
      .filter((s) => s.role !== "none" || priorityFromShare(s.share_pct) !== "none")
      .map((s) => {
        const pr = priorityFromShare(s.share_pct);
        const prTxt =
          pr === "secondary" ? "2nd" : pr === "tertiary" ? "3rd" : "—";
        return `${s.sport} [${prTxt}, ${s.role}]`;
      });

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
          <InfoPopover text="Vyber hlavný šport. Ostatným nastav dôležitosť (2nd/3rd) a rolu (supplement / improve). 'none' = coach ten šport ignoruje." />
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
              Ak máš len beh: nechaj ostatné športy na &quot;none&quot;.
              Ak pridáš bicykel/plávanie, nastav im priority 2nd/3rd a rolu
              supplement/improve.
            </div>
          </div>

          {/* Secondary rows */}
          <div className="grid grid-cols-1 gap-2">
            {secondary.map((sec) => {
              const priority = priorityFromShare(sec.share_pct);
              const isOff = priority === "none" && sec.role === "none";

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
                      {(["none", "secondary", "tertiary"] as const).map((p) => {
                        const active = priority === p;
                        const label =
                          p === "none" ? "—" : p === "secondary" ? "2nd" : "3rd";
                        return (
                          <Button
                            key={p}
                            type="button"
                            size="xs"
                            variant="prefs"
                            active={active}
                            onClick={() => {
                              const newShare = shareFromPriority(p);
                              // ak vypíname, necháme rolu ako je; coach ignoruje, keď share=0 a/alebo role=none
                              updateSecondary(sec.sport, { share_pct: newShare });
                            }}
                            title={label}
                          >
                            {label}
                          </Button>
                        );
                      })}
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
                                // keď zapíname rolu, a share je 0 -> daj default tertiary
                                const pr = priorityFromShare(sec.share_pct);
                                const newShare =
                                  pr === "none"
                                    ? shareFromPriority("tertiary")
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
                        This sport is currently ignored in planning.
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