export type CombatRoundTimelineScrollMode = "center" | "nearest";

export interface CombatRoundTimelineScrollGeometry {
  cellLeft: number;
  cellWidth: number;
  containerLeft: number;
  containerWidth: number;
  padding?: number;
  scrollLeft: number;
  scrollMax?: number;
}

function clampScrollLeft(scrollLeft: number, scrollMax?: number): number {
  const lowerBounded = Math.max(0, scrollLeft);

  return scrollMax === undefined ? lowerBounded : Math.min(lowerBounded, Math.max(0, scrollMax));
}

export function calculateCombatRoundTimelineScrollLeft(
  geometry: CombatRoundTimelineScrollGeometry,
  mode: CombatRoundTimelineScrollMode = "nearest",
): number {
  const padding = geometry.padding ?? 72;
  const cellRight = geometry.cellLeft + geometry.cellWidth;
  const containerRight = geometry.containerLeft + geometry.containerWidth;
  const paddedLeft = geometry.containerLeft + padding;
  const paddedRight = containerRight - padding;

  if (mode === "center") {
    const cellCenter = geometry.cellLeft + geometry.cellWidth / 2;
    const containerCenter = geometry.containerLeft + geometry.containerWidth / 2;

    return clampScrollLeft(
      geometry.scrollLeft + cellCenter - containerCenter,
      geometry.scrollMax,
    );
  }

  if (geometry.cellLeft >= paddedLeft && cellRight <= paddedRight) {
    return geometry.scrollLeft;
  }

  if (geometry.cellLeft < paddedLeft) {
    return clampScrollLeft(
      geometry.scrollLeft + geometry.cellLeft - paddedLeft,
      geometry.scrollMax,
    );
  }

  if (cellRight > paddedRight) {
    return clampScrollLeft(
      geometry.scrollLeft + cellRight - paddedRight,
      geometry.scrollMax,
    );
  }

  return geometry.scrollLeft;
}

export function scrollCombatRoundTimelineCellIntoView(input: {
  behavior?: ScrollBehavior;
  cell?: HTMLElement | null;
  container?: HTMLElement | null;
  mode?: CombatRoundTimelineScrollMode;
  padding?: number;
}): void {
  if (!input.cell || !input.container) {
    return;
  }

  const containerRect = input.container.getBoundingClientRect();
  const cellRect = input.cell.getBoundingClientRect();
  const nextScrollLeft = calculateCombatRoundTimelineScrollLeft(
    {
      cellLeft: cellRect.left,
      cellWidth: cellRect.width,
      containerLeft: containerRect.left,
      containerWidth: containerRect.width,
      padding: input.padding,
      scrollLeft: input.container.scrollLeft,
      scrollMax: input.container.scrollWidth - input.container.clientWidth,
    },
    input.mode,
  );

  if (Math.abs(nextScrollLeft - input.container.scrollLeft) < 1) {
    return;
  }

  input.container.scrollTo({
    behavior: input.behavior ?? "smooth",
    left: nextScrollLeft,
  });
}
