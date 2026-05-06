"use client";

import { useEffect } from "react";

import { writeRememberedSelection } from "./rememberedSelection";

interface RememberedSelectionEffectProps {
  selectionKey: string;
  value?: string | null;
}

export default function RememberedSelectionEffect({
  selectionKey,
  value,
}: RememberedSelectionEffectProps) {
  useEffect(() => {
    writeRememberedSelection(selectionKey, value);
  }, [selectionKey, value]);

  return null;
}
