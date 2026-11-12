import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  PenLine,
  Eraser,
  Undo2,
  Redo2,
  Hand,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
} from "lucide-react";
import {
  blankPage,
  strokeHit,
  type InkPage,
  type InkPoint,
  type InkStroke,
} from "./ink";

type Tools = { color: string; width: number; erase: boolean; pan?: boolean };
const colors = [
  "#172b3a",
  "#ffffff",
  "#e64662",
  "#247bcc",
  "#218453",
  "#e3ac18",
];
function ToolsBar({
  tools,
  setTools,
  undo,
  redo,
  clear,
  canUndo,
  canRedo,
  canClear,
  disabled = false,
  allowPan = false,
  canPan = false,
}: {
  tools: Tools;
  setTools: (t: Tools) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  disabled?: boolean;
  allowPan?: boolean;
  canPan?: boolean;
}) {
  return (
    <div className="ink-tools" role="group" aria-label="Drawing tools">
      <button
        className="button"
        aria-label="Pen"
        aria-pressed={!tools.erase && !tools.pan}
        onClick={() => setTools({ ...tools, erase: false, pan: false })}
      >
        <PenLine size={16} />
      </button>
      <button
        className="button"
        aria-label="Erase stroke"
        title="Erase a whole stroke"
        aria-pressed={tools.erase}
        onClick={() => setTools({ ...tools, erase: true, pan: false })}
      >
        <Eraser size={16} />
      </button>
      {allowPan && (
        <button
          className="button ink-pan-tool"
          aria-label="Pan drawing"
          aria-pressed={!!tools.pan}
          disabled={!canPan}
          title="Drag to move the page. You can also drag with two fingers."
          onClick={() => setTools({ ...tools, erase: false, pan: true })}
        >
          <Hand size={16} /> <span>Pan</span>
        </button>
      )}
      <label>
        Ink{" "}
        <input
          type="color"
          aria-label="Ink color"
          value={tools.color}
          onChange={(e) =>
            setTools({
              ...tools,
              color: e.target.value,
              erase: false,
              pan: false,
            })
          }
        />
      </label>
      <div className="ink-colors">
        {colors.map((color) => (
          <button
            key={color}
            aria-label={`Ink ${color}`}
            aria-pressed={tools.color === color}
            style={{ background: color }}
            onClick={() =>
              setTools({ ...tools, color, erase: false, pan: false })
            }
          />
        ))}
      </div>
      <label>
        Width{" "}
        <input
          type="range"
          aria-label="Pen width"
          min={1}
          max={16}
          step={1}
          value={tools.width}
          onChange={(e) => setTools({ ...tools, width: +e.target.value })}
        />
      </label>
      <button
        className="button"
        aria-label="Undo drawing"
        disabled={disabled || !canUndo}
        onClick={undo}
      >
        <Undo2 size={16} />
      </button>
      <button
        className="button"
        aria-label="Redo drawing"
        disabled={disabled || !canRedo}
        onClick={redo}
      >
        <Redo2 size={16} />
      </button>
      <button
        className="button"
        disabled={disabled || !canClear}
        onClick={() => {
          if (confirm("Clear this drawing? You can undo this action.")) clear();
        }}
      >
        Clear drawing
      </button>
    </div>
  );
}

function Stroke({ stroke }: { stroke: InkStroke }) {
  if (stroke.points.length === 1)
    return (
      <circle
        cx={stroke.points[0][0]}
        cy={stroke.points[0][1]}
        r={stroke.width / 2}
        fill={stroke.color}
      />
    );
  return (
    <polyline
      points={stroke.points.map((p) => p.join(",")).join(" ")}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function InkSurface({
  page,
  onChange,
  tools,
  active,
  paper = false,
  label,
  onOverflow,
}: {
  page: InkPage;
  onChange: (p: InkPage) => void;
  tools: Tools;
  active: boolean;
  paper?: boolean;
  label: string;
  onOverflow?: (overflow: boolean) => void;
}) {
  const [draft, setDraft] = useState<InkStroke | null>(null);
  const surface = useRef<SVGSVGElement>(null);
  const [visibleWidth, setVisibleWidth] = useState(page.width);
  const [panOffset, setPanOffset] = useState(0);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const maxOffset = paper ? Math.max(0, page.width - visibleWidth) : 0;
  const offset = Math.min(panOffset, maxOffset);
  const touches = useRef(new Map<number, number>());
  const multiPan = useRef(false);
  const gesture = useRef<{
    pointerId: number | null;
    x: number;
    offset: number;
  } | null>(null);
  const clampOffset = (value: number) =>
    Math.max(0, Math.min(maxOffset, value));
  useEffect(() => {
    setPanOffset((value) => Math.max(0, Math.min(maxOffset, value)));
    onOverflow?.(maxOffset > 0.5);
  }, [maxOffset, onOverflow]);
  useLayoutEffect(() => {
    const svg = surface.current;
    if (!paper || !svg) return;
    const measure = () =>
      setVisibleWidth(
        (page.height * svg.clientWidth) / Math.max(1, svg.clientHeight),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [paper, page.height]);
  const stroke = useRef<InkStroke | null>(null);
  const pointer = useRef<number | null>(null);
  const erased = useRef(new Set<number>());
  const [erasedIndices, setErasedIndices] = useState(new Set<number>());
  useEffect(() => {
    const svg = surface.current;
    if (!paper || !svg || maxOffset <= 0.5) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || pointer.current !== null || gesture.current) return;
      e.preventDefault();
      e.stopPropagation();
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? svg.clientWidth : 1;
      setPanOffset((value) =>
        Math.max(
          0,
          Math.min(
            maxOffset,
            value +
              (delta * unit * visibleWidth) / Math.max(1, svg.clientWidth),
          ),
        ),
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [paper, maxOffset, visibleWidth]);
  const point = (e: ReactPointerEvent<SVGSVGElement>): InkPoint => {
    const svg = e.currentTarget,
      rect = svg.getBoundingClientRect();
    const width = paper ? visibleWidth : svg.clientWidth,
      height = paper ? page.height : svg.clientHeight;
    return [
      offset +
        Math.max(
          0,
          Math.min(width, ((e.clientX - rect.left) * width) / rect.width),
        ),
      Math.max(
        0,
        Math.min(height, ((e.clientY - rect.top) * height) / rect.height),
      ),
    ];
  };
  const erase = (at: InkPoint) => {
    page.strokes.forEach((s, index) => {
      if (strokeHit(s, at)) erased.current.add(index);
    });
    setErasedIndices(new Set(erased.current));
  };
  const cancel = () => {
    pointer.current = null;
    stroke.current = null;
    setDraft(null);
    erased.current.clear();
    setErasedIndices(new Set());
  };
  const cancelGesture = () => {
    cancel();
    touches.current.clear();
    multiPan.current = false;
    gesture.current = null;
    setPanning(false);
  };
  useEffect(() => {
    if (!active) cancel();
  }, [active]);
  const canvas = (
    <svg
      ref={surface}
      className={`ink-surface ${active ? "ink-active" : ""} ${paper ? "ink-paper" : ""} ${paper && maxOffset > 0.5 && (tools.pan || spaceHeld) ? "ink-can-pan" : ""} ${panning ? "ink-panning" : ""}`}
      role="img"
      aria-label={label}
      tabIndex={paper ? 0 : undefined}
      viewBox={paper ? `${offset} 0 ${visibleWidth} ${page.height}` : undefined}
      preserveAspectRatio="none"
      onKeyDown={(e) => {
        if (!paper || maxOffset <= 0.5) return;
        if (e.code === "Space") {
          e.preventDefault();
          setSpaceHeld(true);
        }
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          setPanOffset(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? maxOffset
                : clampOffset(
                    offset +
                      ((e.key === "ArrowLeft" ? -1 : 1) * visibleWidth) / 5,
                  ),
          );
        }
      }}
      onKeyUp={(e) => {
        if (e.code === "Space") {
          e.preventDefault();
          setSpaceHeld(false);
        }
      }}
      onBlur={() => {
        setSpaceHeld(false);
        cancelGesture();
      }}
      onPointerDown={(e) => {
        if (paper && e.pointerType === "touch") {
          touches.current.set(e.pointerId, e.clientX);
          e.currentTarget.setPointerCapture(e.pointerId);
          if (touches.current.size >= 2 || multiPan.current) {
            e.stopPropagation();
            cancel();
            multiPan.current = true;
            const xs = [...touches.current.values()];
            gesture.current = {
              pointerId: null,
              x: xs.reduce((a, b) => a + b, 0) / xs.length,
              offset,
            };
            setPanning(maxOffset > 0.5);
            return;
          }
        }
        if (
          paper &&
          maxOffset > 0.5 &&
          (e.button === 0 || e.button === 1) &&
          (tools.pan || spaceHeld || e.button === 1) &&
          !gesture.current &&
          pointer.current === null
        ) {
          if (e.pointerType !== "touch") e.preventDefault();
          e.stopPropagation();
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = { pointerId: e.pointerId, x: e.clientX, offset };
          setPanning(true);
          return;
        }
        if (!active || e.button !== 0 || pointer.current !== null) return;
        if (!paper || e.pointerType !== "touch") e.preventDefault();
        e.stopPropagation();
        if (paper) e.currentTarget.focus({ preventScroll: true });
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = point(e);
        if (tools.erase) erase(at);
        else {
          stroke.current = {
            color: tools.color,
            width: tools.width,
            points: [at],
          };
          setDraft(stroke.current);
        }
      }}
      onPointerMove={(e) => {
        if (touches.current.has(e.pointerId))
          touches.current.set(e.pointerId, e.clientX);
        const pan = gesture.current;
        if (pan && (pan.pointerId === e.pointerId || multiPan.current)) {
          e.preventDefault();
          e.stopPropagation();
          const xs = [...touches.current.values()];
          if (multiPan.current && xs.length < 2) return;
          const x = multiPan.current
            ? xs.reduce((a, b) => a + b, 0) / xs.length
            : e.clientX;
          setPanOffset(
            clampOffset(
              pan.offset -
                ((x - pan.x) * visibleWidth) /
                  Math.max(1, e.currentTarget.getBoundingClientRect().width),
            ),
          );
          return;
        }
        if (multiPan.current) return;
        if (pointer.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        const at = point(e);
        if (tools.erase) erase(at);
        else if (stroke.current) {
          const last = stroke.current.points.at(-1)!;
          if (Math.hypot(last[0] - at[0], last[1] - at[1]) >= 0.75) {
            stroke.current = {
              ...stroke.current,
              points: [
                ...(stroke.current.points.length >= 2048
                  ? stroke.current.points.filter((_, i) => i % 2 === 0)
                  : stroke.current.points),
                at,
              ],
            };
            setDraft(stroke.current);
          }
        }
      }}
      onPointerUp={(e) => {
        touches.current.delete(e.pointerId);
        if (multiPan.current || gesture.current?.pointerId === e.pointerId) {
          e.stopPropagation();
          if (!multiPan.current || touches.current.size === 0) {
            gesture.current = null;
            multiPan.current = false;
            setPanning(false);
          }
          return;
        }
        if (pointer.current !== e.pointerId) return;
        e.stopPropagation();
        const next = tools.erase
          ? page.strokes.filter((_, i) => !erased.current.has(i))
          : stroke.current
            ? [...page.strokes, stroke.current]
            : page.strokes;
        const updated = {
          ...page,
          width: paper
            ? Math.max(page.width, visibleWidth + offset)
            : Math.max(page.width, e.currentTarget.clientWidth),
          height: paper
            ? page.height
            : Math.max(page.height, e.currentTarget.clientHeight),
          strokes: next,
        };
        cancel();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        onChange(updated);
      }}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={(e) => {
        if (
          pointer.current === e.pointerId ||
          gesture.current?.pointerId === e.pointerId ||
          touches.current.has(e.pointerId)
        )
          cancelGesture();
      }}
    >
      {page.strokes.map(
        (s, i) => !erasedIndices.has(i) && <Stroke key={i} stroke={s} />,
      )}
      {draft && <Stroke stroke={draft} />}
    </svg>
  );
  if (!paper) return canvas;
  return (
    <div className="ink-paper-viewport">
      {canvas}
      <div
        className="ink-pan-navigation"
        style={{ visibility: maxOffset > 0.5 ? "visible" : "hidden" }}
        role="group"
        aria-label="Move around drawing"
      >
        <button
          className="button"
          aria-label="Pan drawing left"
          disabled={offset <= 0}
          onClick={() => setPanOffset(clampOffset(offset - visibleWidth / 2))}
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="range"
          aria-label="Drawing horizontal position"
          title="Move across the full drawing"
          min={0}
          max={maxOffset}
          step="any"
          value={offset}
          onChange={(e) => setPanOffset(+e.target.value)}
        />
        <button
          className="button"
          aria-label="Pan drawing right"
          disabled={offset >= maxOffset}
          onClick={() => setPanOffset(clampOffset(offset + visibleWidth / 2))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function AnnotationToolbar({
  viewport,
  children,
}: {
  viewport: HTMLDivElement;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 8, y: 8 });
  const [bounds, setBounds] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const move = ({ x, y }: { x: number; y: number }) => {
    const area = host.current;
    const bar = toolbar.current;
    if (!area || !bar) return;
    setPosition({
      x: Math.max(8, Math.min(x, area.clientWidth - bar.offsetWidth - 8)),
      y: Math.max(8, Math.min(y, area.clientHeight - bar.offsetHeight - 8)),
    });
  };
  useLayoutEffect(() => {
    const measure = () =>
      setBounds({
        left: viewport.offsetLeft,
        top: viewport.offsetTop,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (viewport.parentElement) observer.observe(viewport.parentElement);
    return () => observer.disconnect();
  }, [viewport]);
  useLayoutEffect(() => {
    const area = host.current;
    const bar = toolbar.current;
    if (!area || !bar) return;
    const clamp = () =>
      setPosition(({ x, y }) => ({
        x: Math.max(8, Math.min(x, area.clientWidth - bar.offsetWidth - 8)),
        y: Math.max(8, Math.min(y, area.clientHeight - bar.offsetHeight - 8)),
      }));
    clamp();
    const observer = new ResizeObserver(clamp);
    observer.observe(area);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  if (!viewport.parentElement) return null;
  return createPortal(
    <div ref={host} className="annotation-toolbar-host" style={bounds}>
      <div
        ref={toolbar}
        className="annotation-tools"
        style={{ left: position.x, top: position.y }}
        role="region"
        aria-label="Hand annotation toolbar"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          className="annotation-drag-handle"
          aria-label="Move hand annotation toolbar"
          title="Drag or use the arrow keys to move the toolbar"
          onPointerDown={(e) => {
            if (e.button !== 0 || drag.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId,
              x: e.clientX - position.x,
              y: e.clientY - position.y,
            };
          }}
          onPointerMove={(e) => {
            if (drag.current?.id !== e.pointerId) return;
            move({
              x: e.clientX - drag.current.x,
              y: e.clientY - drag.current.y,
            });
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === "Home") {
              e.preventDefault();
              move({ x: 8, y: 8 });
              return;
            }
            const x =
              e.key === "ArrowLeft" ? -24 : e.key === "ArrowRight" ? 24 : 0;
            const y =
              e.key === "ArrowUp" ? -24 : e.key === "ArrowDown" ? 24 : 0;
            if (!x && !y) return;
            e.preventDefault();
            move({ x: position.x + x, y: position.y + y });
          }}
        >
          <GripHorizontal size={17} /> Hand annotation
        </button>
        <div className="annotation-tool-body">{children}</div>
      </div>
    </div>,
    viewport.parentElement,
  );
}

export function Annotations({
  page,
  active,
  onChange,
  onDone,
  viewport,
}: {
  page: InkPage;
  active: boolean;
  onChange: (p: InkPage) => void;
  onDone: () => void;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const [tools, setTools] = useState<Tools>({
    color: "#e64662",
    width: 3,
    erase: false,
  });
  const [past, setPast] = useState<InkPage[]>([]),
    [future, setFuture] = useState<InkPage[]>([]);
  const commit = (next: InkPage) => {
    onChange(next);
    setPast((p) => [...p.slice(-49), page]);
    setFuture([]);
  };
  return (
    <div className="annotation-layer">
      <InkSurface
        page={page}
        active={active}
        onChange={commit}
        tools={tools}
        label="Hand annotation layer"
      />
      {active && viewport.current && (
        <AnnotationToolbar viewport={viewport.current}>
          <ToolsBar
            tools={tools}
            setTools={setTools}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            canClear={page.strokes.length > 0}
            undo={() => {
              const previous = past.at(-1)!;
              onChange(previous);
              setPast(past.slice(0, -1));
              setFuture([...future, page]);
            }}
            redo={() => {
              const next = future.at(-1)!;
              onChange(next);
              setFuture(future.slice(0, -1));
              setPast([...past, page]);
            }}
            clear={() => commit({ ...page, strokes: [] })}
          />
          <button className="primary small" onClick={onDone}>
            Done annotating
          </button>
        </AnnotationToolbar>
      )}
    </div>
  );
}

export function HandwritingEditor({
  initial,
  title,
  onTitle,
  onSave,
  onDone,
  saveStatus,
}: {
  initial?: InkPage;
  title: string;
  onTitle: (title: string) => void;
  onSave: (page: InkPage) => Promise<void>;
  onDone: () => Promise<void>;
  saveStatus: string;
}) {
  const [page, setPage] = useState(initial || blankPage);
  const [overflow, setOverflow] = useState(false);
  const [tools, setTools] = useState<Tools>({
    color: "#172b3a",
    width: 4,
    erase: false,
  });
  const [past, setPast] = useState<InkPage[]>([]),
    [future, setFuture] = useState<InkPage[]>([]);
  const [side, setSide] = useState<"left" | "right">("left"),
    [wide, setWide] = useState(false);
  useEffect(() => {
    if (!overflow)
      setTools((current) =>
        current.pan ? { ...current, pan: false } : current,
      );
  }, [overflow]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false),
    started = useRef(false),
    titleInput = useRef<HTMLInputElement>(null);
  const persist = async (next: InkPage) => {
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleInput.current?.focus();
    if (!started.current) {
      started.current = true;
      if (!initial) void persist(page);
    }
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saving.current || error) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [error]);
  const commit = (next: InkPage) => {
    if (saving.current) return;
    setPast((p) => [...p.slice(-49), page]);
    setFuture([]);
    setPage(next);
    void persist(next);
  };
  const undo = () => {
    if (!past.length || saving.current) return;
    const next = past.at(-1)!;
    setPast(past.slice(0, -1));
    setFuture([...future, page]);
    setPage(next);
    void persist(next);
  };
  const redo = () => {
    if (!future.length || saving.current) return;
    const next = future.at(-1)!;
    setFuture(future.slice(0, -1));
    setPast([...past, page]);
    setPage(next);
    void persist(next);
  };
  const close = async () => {
    if (saving.current || error) return;
    setBusy(true);
    try {
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <section
      className={`handwriting-editor ink-${side} ${wide ? "ink-wide" : ""}`}
      aria-label="Hand written page"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          void close();
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "z" &&
          !(e.target instanceof HTMLInputElement)
        ) {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
      }}
    >
      <header className="handwriting-heading">
        <input
          ref={titleInput}
          aria-label="Hand written node title"
          placeholder="Hand written"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
        />
        <button
          className="button handwriting-layout-control"
          aria-label={
            wide
              ? "Restore half-screen writing page"
              : "Full screen writing page (90% width)"
          }
          title={wide ? "Half screen" : "Full screen · 90% width"}
          onClick={() => setWide(!wide)}
        >
          {wide ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          className="button handwriting-layout-control"
          aria-label={`Move writing page to ${side === "left" ? "right" : "left"}`}
          disabled={wide}
          title={wide ? "Restore half screen to swap sides" : "Swap sides"}
          onClick={() => setSide(side === "left" ? "right" : "left")}
        >
          <ArrowLeftRight size={18} />
        </button>
      </header>
      <ToolsBar
        tools={tools}
        setTools={setTools}
        allowPan
        canPan={overflow}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        canClear={page.strokes.length > 0}
        disabled={busy}
        undo={undo}
        redo={redo}
        clear={() => commit({ ...page, strokes: [] })}
      />
      <div className="handwriting-paper-space">
        <div className="handwriting-paper">
          <InkSurface
            page={page}
            tools={tools}
            active={!busy}
            onChange={commit}
            paper
            onOverflow={setOverflow}
            label="Hand written drawing canvas"
          />
        </div>
      </div>
      <footer className="handwriting-footer">
        <span role="status">
          {error ||
            (busy
              ? "Preparing drawing…"
              : saveStatus === "saved"
                ? "All changes saved"
                : saveStatus === "failed"
                  ? "Save failed. Use Done to retry."
                  : "Saving…")}
        </span>
        {error && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void persist(page)}
          >
            Retry drawing save
          </button>
        )}
        <button
          className="primary"
          disabled={busy || !!error}
          onClick={() => void close()}
        >
          Done
        </button>
      </footer>
    </section>
  );
}
