// src/app/contact/page.tsx
import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function ContactPage() {
  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>Contact</h1>
          </div>

          <div className="text-sm leading-6 space-y-3" style={{ color: appColors.textSecondary }}>
            <p>
              If you have questions about SelfRace, privacy, or Strava integration, reach out:
            </p>
            <p className="font-medium" style={{ color: appColors.textPrimary }}>
              patrikmbontar@gmail.com
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}