"use client";

import { useRef, useState, type PointerEvent } from "react";

import styles from "./BlackboardWorkspace.module.css";

interface ArtifactInspectionViewportProps {
  alt: string;
  src: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const PAN_STEP = 48;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function ArtifactInspectionViewport({ alt, src }: ArtifactInspectionViewportProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number } | undefined>(undefined);

  function reset(): void {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function changeScale(delta: number): void {
    setScale((current) => clampScale(current + delta));
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
    setOffset((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
  }

  function endPan(event: PointerEvent<HTMLDivElement>): void {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <section aria-label="Artifact image controls" className={styles.artifactViewer}>
      <div className={styles.artifactToolbar}>
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
          Reset view
        </button>
      </div>
      <div
        aria-label="Pan and zoom Artifact"
        className={styles.artifactViewport}
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
              setOffset((current) => ({ ...current, x: current.x - PAN_STEP }));
              break;
            case "ArrowRight":
              event.preventDefault();
              setOffset((current) => ({ ...current, x: current.x + PAN_STEP }));
              break;
            case "ArrowUp":
              event.preventDefault();
              setOffset((current) => ({ ...current, y: current.y - PAN_STEP }));
              break;
            case "ArrowDown":
              event.preventDefault();
              setOffset((current) => ({ ...current, y: current.y + PAN_STEP }));
              break;
          }
        }}
        onPointerCancel={endPan}
        onPointerDown={beginPan}
        onPointerMove={continuePan}
        onPointerUp={endPan}
        role="group"
        tabIndex={0}
      >
        <img
          alt={alt}
          className={styles.artifactImage}
          draggable={false}
          src={src}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
      <p className={styles.muted}>
        Drag to pan. Use +/− to zoom, arrow keys to pan, and 0 to reset.
      </p>
    </section>
  );
}
