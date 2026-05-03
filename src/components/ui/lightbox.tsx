"use client";

/** <Lightbox> — fullscreen image viewer with zoom, pan, swipe, keyboard nav.
 *
 *  Props:
 *    images:    [{src, alt?}]
 *    index:     starting index (controlled; pair with onIndexChange)
 *    open:      controlled visibility
 *    onClose:   close handler
 *    onIndexChange: index change handler
 *
 *  Interaction:
 *    - Click backdrop / Esc / × button   → close
 *    - Arrow keys / on-screen ← →        → prev / next
 *    - Wheel / pinch                     → zoom (1x – 5x)
 *    - Drag (when zoomed)                → pan
 *    - Double-click / double-tap         → toggle 1x ↔ 2x
 *    - Swipe (when at 1x on touch)       → prev / next
 *
 *  Implementation note: zoom/pan state is reset whenever `index` or `open`
 *  changes by remounting the inner stage (`key={\`${index}-${open}\`}`)
 *  rather than effects-with-setState, which keeps lint clean and avoids
 *  cascading-render warnings.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  CaretLeftIcon,
  CaretRightIcon,
  XIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from "@phosphor-icons/react";

type Photo = { src: string; alt?: string };

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

function clampZ(v: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +v.toFixed(3)));
}

export function Lightbox(props: {
  images: Photo[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  // SSR-safe: portal target only exists in the browser. The component starts
  // closed in 100% of real cases, so this `typeof document` guard is purely
  // defensive against SSR / pre-hydration calls.
  if (!props.open || typeof document === "undefined") return null;
  const photo = props.images[props.index];
  if (!photo) return null;
  return createPortal(
    <LightboxStage key={`${props.index}-${props.images.length}`} {...props} />,
    document.body
  );
}

function LightboxStage({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: Photo[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    sx: number;
    sy: number;
    tx: number;
    ty: number;
  } | null>(null);
  const touchRef = useRef<{
    sx: number;
    sy: number;
    pinchD?: number;
    pinchZ?: number;
    moved: boolean;
  } | null>(null);

  const photo = images[index];

  const goPrev = useCallback(() => {
    if (images.length < 2) return;
    onIndexChange((index - 1 + images.length) % images.length);
  }, [images.length, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (images.length < 2) return;
    onIndexChange((index + 1) % images.length);
  }, [images.length, index, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=")
        setZoom((z) => clampZ(z + ZOOM_STEP));
      else if (e.key === "-" || e.key === "_")
        setZoom((z) => clampZ(z - ZOOM_STEP));
      else if (e.key === "0") {
        setZoom(1);
        setTx(0);
        setTy(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * ZOOM_STEP;
    setZoom((z) => {
      const nz = clampZ(z + delta);
      if (nz === 1) {
        setTx(0);
        setTy(0);
      }
      return nz;
    });
  }

  function onMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx, ty };
    setDragging(true);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setTx(dragRef.current.tx + dx);
    setTy(dragRef.current.ty + dy);
  }
  function onMouseUp() {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
    }
  }

  function onDoubleClick() {
    setZoom((z) => {
      if (z > 1) {
        setTx(0);
        setTy(0);
        return 1;
      }
      return 2;
    });
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = { sx: t.clientX, sy: t.clientY, moved: false };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        sx: 0,
        sy: 0,
        pinchD: Math.hypot(dx, dy),
        pinchZ: zoom,
        moved: false,
      };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return;
    if (e.touches.length === 2 && touchRef.current.pinchD) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const ratio = d / touchRef.current.pinchD;
      const z0 = touchRef.current.pinchZ ?? 1;
      setZoom(clampZ(z0 * ratio));
      touchRef.current.moved = true;
      return;
    }
    if (e.touches.length === 1 && zoom > 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchRef.current.sx;
      const dy = t.clientY - touchRef.current.sy;
      setTx((p) => p + dx);
      setTy((p) => p + dy);
      touchRef.current.sx = t.clientX;
      touchRef.current.sy = t.clientY;
      touchRef.current.moved = true;
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (
      touchRef.current &&
      zoom <= 1 &&
      e.changedTouches.length === 1 &&
      !touchRef.current.pinchD
    ) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchRef.current.sx;
      const dy = t.clientY - touchRef.current.sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) goPrev();
        else goNext();
      }
    }
    touchRef.current = null;
  }

  function backdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
  const isAPI = photo.src.startsWith("/api/");

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-sm select-none"
      onClick={backdropClick}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3 sm:p-4 z-10">
        <div className="tactical-text text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
          {index + 1} / {images.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => clampZ(z - ZOOM_STEP));
            }}
            className="size-9 rounded-sm bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white/80"
            aria-label="Зменшити"
          >
            <MagnifyingGlassMinusIcon className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => clampZ(z + ZOOM_STEP));
            }}
            className="size-9 rounded-sm bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white/80"
            aria-label="Збільшити"
          >
            <MagnifyingGlassPlusIcon className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="size-9 rounded-sm bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white"
            aria-label="Закрити"
          >
            <XIcon className="size-4" weight="bold" />
          </button>
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 size-11 rounded-sm bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white z-10"
            aria-label="Попереднє"
          >
            <CaretLeftIcon className="size-5" weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 size-11 rounded-sm bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white z-10"
            aria-label="Наступне"
          >
            <CaretRightIcon className="size-5" weight="bold" />
          </button>
        </>
      )}

      <div className="relative w-full h-full flex items-center justify-center px-4 sm:px-16 py-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.alt || ""}
          draggable={false}
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
          onClick={(e) => e.stopPropagation()}
          loading="eager"
          decoding="async"
          referrerPolicy={isAPI ? undefined : "no-referrer"}
          style={{
            transform,
            transition: dragging ? "none" : "transform 0.15s ease-out",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
            willChange: "transform",
          }}
        />
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-2 p-3 sm:p-4 overflow-x-auto z-10">
          {images.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(i);
              }}
              className={`relative shrink-0 size-12 sm:size-14 rounded-sm overflow-hidden border-2 ${
                i === index
                  ? "border-[color:var(--accent)]"
                  : "border-white/20 hover:border-white/50"
              }`}
              aria-label={`Фото ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
