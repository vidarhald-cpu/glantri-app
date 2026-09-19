"use client";

import { useRef, useState, type PointerEvent } from "react";

import styles from "./mediaInspection.module.css";

export interface MediaInspectionViewportProps {
  /** Accessible description of the inspected material. */
  alt: string;
  /** What kind of material is being inspected. Documents keep their own reader. */
  kind?: "image" | "document";
  /** Game-world noun used in control names, for example `Artifact` or `Map`. */
  mediaLabel?: string;
  /** Readable source for the material. */
  src: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const PAN_STEP = 48;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * Reusable inspection surface for visual material.
 *
 * The stage and the controls are separate grid rows, so a control never covers
 * the material being inspected.
 */
export function MediaInspectionViewport({
  alt,
  kind = "image",
  mediaLabel = "Artifact",
  src,
}: MediaInspectionViewportProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  if (kind === "document") {
    return (
      <section aria-label={`${mediaLabel} view`} className={styles.viewer}>
        <div className={styles.stage}>
          <iframe className={styles.document} src={src} title={alt} />
        </div>
        <p className={styles.hint}>
          The document uses the whole inspection area. Scroll or use the reader’s own controls.
        </p>
      </section>
    );
  }

  function reset(): void {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  /**
   * Keeps the material reachable: it can be moved only as far as its own
   * overflow allows. Measurement is skipped when layout is not available.
   */
  function clampOffset(
    next: { x: number; y: number },
    nextScale: number,
  ): { x: number; y: number } {
    const stage = stageRef.current?.getBoundingClientRect();
    const image = imageRef.current;
    if (!stage?.width || !image?.clientWidth || !image.clientHeight) return next;
    const limitX = Math.max(0, (image.clientWidth * nextScale - stage.width) / 2);
    const limitY = Math.max(0, (image.clientHeight * nextScale - stage.height) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    };
  }

  function changeScale(delta: number): void {
    const next = clampScale(scale + delta);
    setScale(next);
    setOffset((current) => clampOffset(current, next));
  }

  function panBy(deltaX: number, deltaY: number): void {
    setOffset((current) => clampOffset({ x: current.x + deltaX, y: current.y + deltaY }, scale));
  }

  function beginPan(event: PointerEvent<HTMLDivElement>): void {
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continuePan(event: PointerEvent<HTMLDivElement>): void {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.current.x;
    const deltaY = event.clientY - pointer.current.y;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    panBy(deltaX, deltaY);
  }

  function endPan(event: PointerEvent<HTMLDivElement>): void {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section aria-label={`${mediaLabel} view`} className={styles.viewer}>
      <div
        aria-label={`Pan and zoom ${mediaLabel}`}
        className={styles.stage}
        onDoubleClick={reset}
        onKeyDown={(event) => {
          switch (event.key) {
            case "+":
            case "=":
              event.preventDefault();
              changeScale(SCALE_STEP);
              break;
            case "-":
              event.preventDefault();
              changeScale(-SCALE_STEP);
              break;
            case "0":
              event.preventDefault();
              reset();
              break;
            case "ArrowLeft":
              event.preventDefault();
              panBy(-PAN_STEP, 0);
              break;
            case "ArrowRight":
              event.preventDefault();
              panBy(PAN_STEP, 0);
              break;
            case "ArrowUp":
              event.preventDefault();
              panBy(0, -PAN_STEP);
              break;
            case "ArrowDown":
              event.preventDefault();
              panBy(0, PAN_STEP);
              break;
          }
        }}
        onPointerCancel={endPan}
        onPointerDown={beginPan}
        onPointerMove={continuePan}
        onPointerUp={endPan}
        ref={stageRef}
        role="group"
        tabIndex={0}
      >
        <img
          alt={alt}
          className={styles.image}
          draggable={false}
          ref={imageRef}
          src={src}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
      <div className={styles.toolbar}>
        <button
          aria-label="Zoom out"
          disabled={scale <= MIN_SCALE}
          onClick={() => changeScale(-SCALE_STEP)}
          type="button"
        >
          −
        </button>
        <output aria-live="polite">Zoom {Math.round(scale * 100)}%</output>
        <button
          aria-label="Zoom in"
          disabled={scale >= MAX_SCALE}
          onClick={() => changeScale(SCALE_STEP)}
          type="button"
        >
          +
        </button>
        <button onClick={reset} type="button">
          Fit to screen
        </button>
      </div>
      <p className={styles.hint}>
        Drag to pan. Use +/− to zoom, arrow keys to pan, and 0 to fit the screen again.
      </p>
    </section>
  );
}
