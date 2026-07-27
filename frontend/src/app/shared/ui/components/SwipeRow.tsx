"use client";

import { useRef, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import { useT } from "@/app/shared/i18n/useT";
import {
  SWIPE_ROW,
  SWIPE_ACTIONS,
  SWIPE_CONTENT,
} from "@/app/shared/ui/tokens";

type SwipeRowProps = {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  enableSwipe?: boolean;
};

/**
 * Zdieľaný swipe-to-edit/delete riadok pre zoznamy (PB panely a pod.).
 * Predtým bola táto logika duplikovaná v každom PB paneli osobitne
 * (a v PBStrength dokonca voľne typovaná `any`) — teraz jeden zdroj pravdy.
 */
export default function SwipeRow({
  children,
  onEdit,
  onDelete,
  enableSwipe = true,
}: SwipeRowProps) {
  const t = useT();
  const [tx, setTx] = useState(0);
  const startX = useRef<number | null>(null);
  const startTx = useRef<number>(0);

  const ACTION_W = 168;
  const SNAP_OPEN = -ACTION_W;
  const SNAP_CLOSED = 0;
  const THRESHOLD = 8;

  const clamp = (v: number) => Math.max(SNAP_OPEN, Math.min(SNAP_CLOSED, v));
  const snap = (v: number) =>
    setTx(Math.abs(v) > ACTION_W / 2 ? SNAP_OPEN : SNAP_CLOSED);

  function onTouchStart(e: React.TouchEvent) {
    if (!enableSwipe) return;
    startX.current = e.touches[0].clientX;
    startTx.current = tx;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!enableSwipe || startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) < THRESHOLD) return;
    e.preventDefault();
    setTx(clamp(startTx.current + dx));
  }

  function onTouchEnd() {
    if (!enableSwipe) return;
    snap(tx);
    startX.current = null;
  }

  return (
    <li
      className={SWIPE_ROW}
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className={SWIPE_ACTIONS}>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            setTx(SNAP_CLOSED);
            onEdit();
          }}
        >
          {t("common.edit")}
        </Button>
        <Button size="xs" variant="danger" onClick={onDelete}>
          {t("common.delete")}
        </Button>
      </div>

      <div
        className={[
          SWIPE_CONTENT,
          "transition-transform duration-150 ease-out",
        ].join(" ")}
        style={{ transform: `translateX(${tx}px)` }}
      >
        {children}
      </div>
    </li>
  );
}