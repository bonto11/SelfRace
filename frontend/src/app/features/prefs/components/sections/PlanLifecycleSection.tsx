// src/app/features/prefs/components/sections/PlanLifecycleSection.tsx
"use client";

export default function PlanLifecycleSection({
  canGenerate,
}: {
  canGenerate: boolean;
}) {
  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #333" }}>
      <div style={{ color: "white" }}>PLAN LIFECYCLE TEST - canGenerate: {String(canGenerate)}</div>
    </div>
  );
}
