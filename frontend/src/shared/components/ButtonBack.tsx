// src/shared/components/ui/BackButton.tsx
"use client";
import { useRouter } from "next/navigation";
import Button from "./Button";

type Props = {
  href?: string;       // ak zadáš, použije push na konkrétnu URL
  label?: string;
  size?: import("@/shared/ui").ButtonSize;
  className?: string;
};

export default function BackButton({ href, label = "Späť", size="sm", className }: Props) {
  const router = useRouter();
  return (
    <Button
      variant="back"
      size={size}
      className={className}
      onClick={() => (href ? router.push(href) : router.back())}
    >
      {label}
    </Button>
  );
}