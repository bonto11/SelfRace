// src/app/shared/ui/components/ErrorBoundary.tsx
"use client";

import * as React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Zachytáva JS chyby VO VNÚTRI {children} (napr. chýbajúci i18n kľúč, ktorý
 * spôsobí throw počas renderu konkrétnej stránky), aby nepostihli rodičovský
 * strom - header, sidebar, bottom bar v ClientProtectedShell zostávajú VŽDY
 * viditeľné a funkčné, aj keď obsah jednej konkrétnej stránky spadne.
 *
 * Toto je ochranná/obchádzková vrstva - nerieši príčinu chyby, len bráni
 * tomu, aby jedna chyba na jednej stránke rozbila celú appku. Skutočná
 * chyba sa stále dá vidieť v konzole (console.error nižšie).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Zachytená chyba na stránke:", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    // Ak sa zmenili children (napr. used prešiel na inú stránku), resetuj
    // error stav - nová stránka dostane čistú šancu vykresliť sa.
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "white" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Niečo sa na tejto stránke pokazilo.
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Skús sa vrátiť späť alebo obnoviť stránku.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
