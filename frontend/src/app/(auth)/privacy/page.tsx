// src/app/privacy/page.tsx
import {
  SURFACE_CARD,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

const PDF_URL = "/documents/PrivacyPolicy_SelfRace.pdf";

export default function PrivacyPage() {
  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>Privacy Policy</h1>

            <a
              href={PDF_URL}
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
            >
              Download PDF
            </a>
          </div>

          <div
            className="w-full overflow-hidden rounded-xl border"
            style={{
              borderColor: appColors.divider,
              background: appColors.backgroundAlt,
            }}
          >
            <iframe
              title="Privacy Policy PDF"
              src={PDF_URL}
              className="block w-full"
              style={{
                height: 780,
                background: appColors.backgroundAlt,
                border: "0",
              }}
            />

            {/* fallback */}
            <div
              className="p-3 text-sm"
              style={{ color: appColors.textSecondary }}
            >
              If your browser can’t display PDFs inline,&nbsp;
              <a
                href={PDF_URL}
                className="underline"
                style={{ color: appColors.textPrimary }}
              >
                download the PDF
              </a>
              .
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}