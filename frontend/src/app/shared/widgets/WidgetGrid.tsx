// src/app/shared/widgets/WidgetGrid.tsx
"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, SlidersHorizontal } from "lucide-react";

import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import Button from "@/app/shared/ui/components/Button";
import { WidgetEmpty } from "@/app/shared/ui/widget/WidgetParts";
import { useT } from "@/app/shared/i18n/useT";
import CatalogWidget from "@/app/shared/widgets/CatalogWidget";
import { useWidgetLayout } from "@/app/shared/widgets/useWidgetLayout";
import { WIDGETS, type WidgetId, type WidgetSection } from "@/app/shared/widgets/widgetCatalog";

export const WIDGETS_SETTINGS_HREF = "/settings/widgets";

/** Tichý odkaz na výber widgetov – na konci Domova a sekcií. */
export function EditWidgetsLink({ label }: { label?: string }) {
  const t = useT();
  const router = useRouter();
  const { editable } = useWidgetLayout();
  if (!editable) return null;
  return (
    <div className="flex justify-center pt-2">
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<SlidersHorizontal size={14} />}
        onClick={() => router.push(WIDGETS_SETTINGS_HREF)}
      >
        {label ?? t("widgetCatalog.editLink")}
      </Button>
    </div>
  );
}

/**
 * Widgety jednej sekcie podľa voľby usera.
 * order = vlastné poradie (tréner podľa toho, či beží plán); inak poradie katalógu.
 */
export default function WidgetGrid({ section, order }: { section: WidgetSection; order?: WidgetId[] }) {
  const t = useT();
  const router = useRouter();
  const { isOn, isAvailable, editable } = useWidgetLayout();

  const ids = (order ?? WIDGETS.filter((w) => w.section === section).map((w) => w.id)).filter(
    (id) => isOn(id) && isAvailable(id),
  );

  return (
    <div className="space-y-4">
      {ids.length ? (
        <div className={PAGE_GRID_2}>
          {ids.map((id) => (
            <CatalogWidget key={id} id={id} />
          ))}
        </div>
      ) : (
        <section className={[CARD, "p-4"].join(" ")} style={SURFACE_CARD_STYLE}>
          <WidgetEmpty icon={LayoutGrid} text={t("widgetCatalog.sectionEmpty")}>
            {editable ? (
              <div>
                <Button size="sm" variant="secondary" onClick={() => router.push(WIDGETS_SETTINGS_HREF)}>
                  {t("widgetCatalog.editLink")}
                </Button>
              </div>
            ) : null}
          </WidgetEmpty>
        </section>
      )}
      {ids.length ? <EditWidgetsLink /> : null}
    </div>
  );
}
