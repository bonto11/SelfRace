// src/shared/components/ui/ButtonBack.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cx, buttonClass } from "@/app/shared/ui";

type Props = {
  /** Text vľavo v headri (voliteľný) */
  title?: string;
  /** Ak nastavíš, pôjde sa sem (ignoruje auto-back) */
  href?: string;
  /** Kam ísť, keď nie je history (pri priamom vstupe na URL). Default: "/" */
  fallbackHref?: string;
  /** Text na tlačidle (default: "Späť") */
  label?: string;
  /** Extra class pre vonkajší (full-bleed) wrapper */
  className?: string;
  /** Extra class pre vnútorný riadok (flex) */
  innerClassName?: string;
  /** Sticky header pod notch (default: true) */
  sticky?: boolean;
  /** Zarovnať na šírku content kontajnera (default: true) */
  container?: boolean;
  /** Voliteľne: callback po návrate */
  onBack?: () => void;
};

export default function ButtonBack({
  title,
  href,
  fallbackHref = "/",
  label = "Späť",
  className,
  innerClassName,
  sticky = true,
  container = true,
  onBack,
}: Props) {
  const router = useRouter();

  const goBack = () => {
    // keď je explicitné href, rieši to Link nižšie
    if (onBack) onBack();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  const backCls = buttonClass("back", "sm", { circle: false });

  const BackPill = (
    <span className={backCls}>
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </span>
  );

  return (
    <div
      className={cx(
        // sticky bar so safe-area (iOS notch) + z-index nad obsah
        sticky && "sticky top-[max(env(safe-area-inset-top),0px)] z-30",
        // full-bleed appbar look
        "-mx-3 px-3 md:rounded-b",
        "bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40",
        "dark:bg-black/60 dark:supports-[backdrop-filter]:bg-black/40",
        // jemná spodná deliaca linka (hairline)
        "border-b border-white/10",
        className
      )}
      role="banner"
    >
      <div className={cx(container && "max-w-screen-lg mx-auto", "py-2")}>
        <div className={cx("flex items-center gap-3", innerClassName)}>
          {title ? (
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          ) : (
            <span className="sr-only">Header</span>
          )}

          <div className="ml-auto">
            {href ? (
              <Link href={href} aria-label={label}>
                {BackPill}
              </Link>
            ) : (
              <button
                type="button"
                onClick={goBack}
                aria-label={label}
                className="focus:outline-none"
              >
                {BackPill}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
