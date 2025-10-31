"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cx } from "@/shared/ui";

type Props = {
  /** Text vľavo v headri (voliteľný) */
  title?: string;
  /** Kam sa vrátiť; ak nie je, použije `router.back()` */
  href?: string;
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
};

export default function ButtonBack({
  title,
  href,
  label = "Späť",
  className,
  innerClassName,
  sticky = true,
  container = true,
}: Props) {
  const router = useRouter();

  const BackPill = (
    <span className={cx(
      "inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full",
      "bg-gray-700 hover:bg-gray-600 text-white transition",
      "border border-white/10"
    )}>
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </span>
  );

  return (
    <div
      className={cx(
        sticky && "sticky top-[max(env(safe-area-inset-top),0px)] z-20",
        // full-bleed pozadie (vyzerá ako app bar)
        "-mx-3 px-3 md:rounded-b",
        "bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40",
        "dark:bg-black/60 dark:supports-[backdrop-filter]:bg-black/40",
        className
      )}
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
                onClick={() => router.back()}
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