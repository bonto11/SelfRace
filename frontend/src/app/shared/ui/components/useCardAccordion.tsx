"use client";

import { useState, type ReactNode } from "react";
import { InputsCardControlContext } from "@/app/shared/ui/components/InputsCard";

/**
 * Akordeón z InputsCard kariet (ako tréningové preferencie) – otvorená je
 * vždy len jedna. Karty bez stavu (fajky), len nadpis a šípka.
 *
 *   const slot = useCardAccordion<"a" | "b">();
 *   {slot("a", <PanelA />)}
 */
export function useCardAccordion<K extends string>(initial: K | null = null) {
  const [openKey, setOpenKey] = useState<K | null>(initial);

  return (key: K, node: ReactNode) => (
    <InputsCardControlContext.Provider
      key={key}
      value={{
        open: openKey === key,
        onOpenChange: (o) => setOpenKey(o ? key : null),
      }}
    >
      {node}
    </InputsCardControlContext.Provider>
  );
}
