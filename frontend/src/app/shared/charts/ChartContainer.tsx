// src/shared/charts/ChartContainer.tsx
'use client';
import { ReactNode } from 'react';

export default function ChartContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-full h-64 sm:h-72 md:h-80 lg:h-96 xl:h-[420px]">
      {children}
    </div>
  );
}
