// src/features/Toolbars/Sidebar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSidebar } from "@/app/features/Toolbars/hooks/useSidebar";
import { useBodyScrollLock } from "@/app/features/Toolbars/hooks/useBodyScrollLock";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  NavIcon,
  type NavId,
} from "@/app/features/Toolbars/components/navIcons";

type Item = { id: NavId; href: string; translationKey: string };

const ITEMS: Item[] = [
  { id: "activities", href: "/activities", translationKey: "activities.title" },
  { id: "coach", href: "/coach", translationKey: "coach.title" },
  { id: "performance", href: "/performance", translationKey: "performance.title" },
  { id: "recovery", href: "/recovery", translationKey: "recovery.title" },
  { id: "calendar", href: "/calendar", translationKey: "calendar.title" },
];

function PillItem({
  item,
  expanded,
  closeMobile,
}: {
  item: Item;
  expanded: boolean;
  closeMobile: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const label = t(item.translationKey as any);

  return (
    <Link
      href={item.href}
      onClick={closeMobile}
      className="group flex items-center gap-3 rounded-2xl transition-colors select-none"
      style={{
        height: 44,
        paddingLeft: 12,
        paddingRight: expanded ? 14 : 12,
        background: isActive ? appColors.brandPrimary : "transparent",
        color: isActive ? appColors.textInverse : appColors.textPrimary,
      }}
    >
      <span
        className="grid place-items-center rounded-2xl"
        style={{
          width: 44,
          height: 36,
          background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
        }}
      >
        {NavIcon({ id: item.id })}
      </span>

      <span
        className="text-sm font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200"
        style={{
          maxWidth: expanded ? 180 : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const t = useT();
  const { open, setOpen } = useSidebar();
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const expanded = hovered;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const closeMobile = () => setOpen(false);

  const width = expanded ? 240 : 88;

  return (
    <>
      {open && (
        <button
          aria-label={t("common.nav.closeMenu" as any)}
          onClick={closeMobile}
          className="fixed inset-0 z-[50] lg:hidden"
          style={{ background: appColors.overlay }}
        />
      )}

      <nav
        ref={panelRef}
        tabIndex={-1}
        aria-label={t("common.nav.primaryAria" as any)}
        className={[
          "fixed inset-y-0 left-0 z-[55] lg:static lg:z-auto",
          "transform transition-transform duration-200 will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          "lg:sticky lg:top-0 lg:h-dvh",
        ].join(" ")}
        style={{
          width: 280,
          background: "transparent",
        }}
      >
        <div
          className="hidden lg:flex h-dvh items-center"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ paddingLeft: 12, paddingRight: 12 }}
        >
          <div
            className="rounded-[28px] backdrop-blur-md shadow-lg transition-[width] duration-200"
            style={{
              width,
              background: appColors.panelBg,
              border: `1px solid ${appColors.panelBorder}`,
              boxShadow: appColors.shadowSoft,
              padding: 10,
            }}
          >
            <div className="flex flex-col gap-2">
              {ITEMS.map((item) => (
                <PillItem
                  key={item.id}
                  item={item}
                  expanded={expanded}
                  closeMobile={() => {}}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="lg:hidden h-dvh"
          style={{
            background: appColors.backgroundAlt,
            color: appColors.textPrimary,
            borderRight: `1px solid ${appColors.divider}`,
          }}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/logo/logo.png"
                alt="SelfRace"
                width={28}
                height={28}
              />
              <div className="font-semibold">SelfRace</div>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl"
              aria-label={t("common.nav.closeMenu" as any)}
              onClick={closeMobile}
              style={{
                border: `1px solid ${appColors.surfaceCardBorder}`,
                background: appColors.buttonGhostBg,
                color: appColors.textPrimary,
              }}
            >
              ✕
            </button>
          </div>

          <div className="px-2 pb-4 space-y-1">
            {ITEMS.map((it) => (
              <Link
                key={it.id}
                href={it.href}
                onClick={closeMobile}
                className="flex items-center gap-3 rounded-2xl px-3 py-2"
                style={{ color: appColors.textPrimary }}
              >
                <span
                  className="w-10 h-10 grid place-items-center rounded-2xl"
                  style={{ border: `1px solid ${appColors.divider}` }}
                >
                  {NavIcon({ id: it.id })}
                </span>
                <span className="font-semibold">{t(it.translationKey as any)}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}