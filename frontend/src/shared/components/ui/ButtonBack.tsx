"use client";
import { useRouter } from "next/navigation";
import Button from "./Button";

type Props = {
  href?: string;
  label?: string;   // ak dáš napr. "←", bude kruh; ak "Späť", ovál
  size?: import("@/shared/ui").ButtonSize;
  className?: string;
};

export default function ButtonBack({ href, label = "←", size = "sm", className }: Props) {
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