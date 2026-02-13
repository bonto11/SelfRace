// src/app/shared/components/ui/AuthShell.tsx
"use client";

import * as React from "react";
import {
  AUTH_PAGE,
  AUTH_PAGE_PAD,
  AUTH_SHELL,
  AUTH_CARD,
  AUTH_CARD_STYLE,
  AUTH_HEADER,
  AUTH_TITLE,
  AUTH_TEXT,
  AUTH_TEXT_STYLE,
  AUTH_STACK,
  AUTH_FOOTER_ROW,
  AUTH_FOOTER_TEXT,
} from "@/app/shared/ui/tokens/auth";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: boolean;
};

export default function AuthShell({
  title,
  description,
  children,
  footer = true,
}: Props) {
  const t = useT();
  return (
    <main className={[AUTH_PAGE, AUTH_PAGE_PAD].join(" ")}>
      <div className={AUTH_SHELL}>
        <div className={[AUTH_CARD, AUTH_STACK].join(" ")} style={AUTH_CARD_STYLE}>
          <header className={AUTH_HEADER}>
            <h1 className={AUTH_TITLE}>{title}</h1>
            {description ? (
              <p className={AUTH_TEXT} style={AUTH_TEXT_STYLE}>
                {description}
              </p>
            ) : null}
          </header>

          {children}

          {footer ? (
            <div className={AUTH_FOOTER_ROW}>
              <span className={AUTH_FOOTER_TEXT}>
                {t("appFooter.shell")}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}