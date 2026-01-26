// src/app/shared/components/ui/CardBackdrop.tsx
"use client";

type Props = {
  /**
   * Default = widget-like green/teal glow.
   * You can later add variants (e.g. "subtle") without renaming the component.
   */
  variant?: "default" | "subtle";
  className?: string;
};

export default function CardBackdrop({ variant = "default", className }: Props) {
  const isSubtle = variant === "subtle";

  return (
    <>
      <div
        className={
          "absolute inset-0 pointer-events-none" + (className ? ` ${className}` : "")
        }
        style={{
          background: `
            radial-gradient(520px 260px at 30% 20%, rgba(63,225,166,${
              isSubtle ? "0.08" : "0.12"
            }), transparent 60%),
            radial-gradient(520px 300px at 80% 70%, rgba(45,212,191,${
              isSubtle ? "0.07" : "0.10"
            }), transparent 62%)
          `,
          opacity: 0.95,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isSubtle
            ? "linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.44))"
            : "linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.52))",
        }}
      />
    </>
  );
}