// src/app/terms/page.tsx
import { SURFACE_CARD, PANEL_PAD, PANEL_INNER_STACK, PANEL_CARD_HEAD, PANEL_CARD_TITLE } from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function TermsPage() {
  return (
    <main className="max-w-screen-lg mx-auto px-3 py-4">
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          <div className={PANEL_CARD_HEAD}>
            <h1 className={PANEL_CARD_TITLE}>Terms</h1>
            <a
              href="/documents/TermsOfService_SelfRace.pdf"
              className="text-xs hover:underline"
              style={{ color: appColors.textSecondary }}
            >
              Download PDF
            </a>
          </div>

          <div
            className="w-full overflow-hidden rounded-xl border"
            style={{ borderColor: appColors.divider, background: appColors.backgroundAlt }}
          >
            <object data="/documents/TermsOfService_SelfRace.pdf" type="application/pdf" width="100%" height="780">
              <div className="p-3 text-sm" style={{ color: appColors.textSecondary }}>
                Your browser can’t display PDFs inline.
                <a
                  href="/documents/TermsOfService_SelfRace.pdf"
                  className="ml-2 underline"
                  style={{ color: appColors.textPrimary }}
                >
                  Download the PDF
                </a>
                .
              </div>
            </object>
          </div>
        </div>
      </section>
    </main>
  );
}