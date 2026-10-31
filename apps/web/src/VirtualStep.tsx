import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Keep lightweight scroll anchors for every node, mounting rich content only
// near the viewport. Measurements use layout pixels so CSS zoom stays correct.
const observers = new WeakMap<
  Element,
  {
    observer: IntersectionObserver;
    listeners: Map<Element, (visible: boolean) => void>;
  }
>();
export default function VirtualStep({
  id,
  className,
  estimatedHeight,
  pinned,
  initial,
  children,
}: {
  id: string;
  className: string;
  estimatedHeight: number;
  pinned: boolean;
  initial: boolean;
  children: () => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initial);
  const height = useRef(estimatedHeight);
  const mounted = visible || pinned;
  useEffect(() => {
    const element = ref.current!;
    const root = element.closest(".canvas-scroll")!;
    let shared = observers.get(root);
    if (!shared) {
      const listeners = new Map<Element, (visible: boolean) => void>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            listeners.get(entry.target)?.(entry.isIntersecting);
        },
        { root, rootMargin: "800px 0px" },
      );
      shared = { observer, listeners };
      observers.set(root, shared);
    }
    shared.listeners.set(element, setVisible);
    shared.observer.observe(element);
    return () => {
      shared.observer.unobserve(element);
      shared.listeners.delete(element);
      if (!shared.listeners.size) {
        shared.observer.disconnect();
        observers.delete(root);
      }
    };
  }, []);
  useLayoutEffect(() => {
    if (!mounted || !ref.current) return;
    const element = ref.current;
    const measure = () => {
      height.current = element.offsetHeight || estimatedHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted, estimatedHeight]);
  return (
    <div
      id={id}
      ref={ref}
      className={className}
      style={{
        minHeight: mounted ? undefined : height.current,
        scrollMarginTop: 28,
      }}
    >
      {mounted ? children() : null}
    </div>
  );
}
