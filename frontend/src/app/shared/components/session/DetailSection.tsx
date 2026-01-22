import { ReactNode, useState } from "react";
import { SURFACE_INLINE } from "@/app/shared/ui/tokens";

type DetailSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function DetailSection({
  title,
  children,
  defaultOpen = true,
}: DetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          SURFACE_INLINE,
          "w-full flex items-center justify-between px-3 py-2",
        ].join(" ")}
      >
        <span className="text-[11px] font-semibold opacity-80 uppercase">
          {title}
        </span>
        <span
          className={[
            "text-sm transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          ▾
        </span>
      </button>

      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
