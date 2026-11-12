import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import {
  formatSelection,
  textFormats,
  type TextFormat,
} from "./textFormatting";

const editors = new WeakMap<HTMLTextAreaElement, (text: string) => void>();
export function useTextFormatting(
  field: RefObject<HTMLTextAreaElement | null>,
  onValueChange?: (text: string) => void,
) {
  useLayoutEffect(() => {
    const element = field.current;
    if (!element || !onValueChange) return;
    editors.set(element, onValueChange);
    return () => {
      editors.delete(element);
    };
  }, [field, onValueChange]);
}
export function FormattedTextarea({
  onValueChange,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  onValueChange: (text: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useTextFormatting(field, onValueChange);
  return (
    <textarea
      {...props}
      ref={field}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
export type FormattingTarget = {
  text: string;
  start: number;
  end: number;
  rect: DOMRect;
  apply: (text: string) => void;
  field?: HTMLTextAreaElement;
};
const icons = [
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading,
  List,
  ListOrdered,
  Quote,
];

export default function SelectionToolbar({
  resolveReadingSelection,
}: {
  resolveReadingSelection: (selection: Selection) => FormattingTarget | null;
}) {
  const [target, setTarget] = useState<FormattingTarget | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const apply = (format: TextFormat) => {
    const current = targetRef.current;
    if (
      !current ||
      (current.field &&
        (!current.field.isConnected ||
          current.field.disabled ||
          current.field.readOnly))
    )
      return;
    const next = formatSelection(
      current.text,
      current.start,
      current.end,
      format,
    );
    current.apply(next.text);
    if (current.field) {
      requestAnimationFrame(() => {
        current.field!.focus({ preventScroll: true });
        current.field!.setSelectionRange(next.start, next.end);
        setTarget({ ...current, ...next });
      });
    } else {
      window.getSelection()?.removeAllRanges();
      setTarget(null);
    }
  };
  useEffect(() => {
    const refresh = () => {
      if (toolbar.current?.contains(document.activeElement)) return;
      const field = document.activeElement;
      if (field instanceof HTMLTextAreaElement) {
        const update = editors.get(field);
        if (
          update &&
          !field.disabled &&
          !field.readOnly &&
          field.selectionEnd > field.selectionStart
        ) {
          setTarget({
            text: field.value,
            start: field.selectionStart,
            end: field.selectionEnd,
            rect: field.getBoundingClientRect(),
            apply: update,
            field,
          });
          return;
        }
      }
      const selection = window.getSelection();
      setTarget(
        selection && !selection.isCollapsed
          ? resolveReadingSelection(selection)
          : null,
      );
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTarget(null);
        return;
      }
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        !targetRef.current
      )
        return;
      const format = textFormats.find(
        (format) => "key" in format && format.key === event.key.toLowerCase(),
      );
      if (format) {
        event.preventDefault();
        apply(format);
      }
    };
    const outside = (event: PointerEvent) => {
      if (toolbar.current?.contains(event.target as Node)) return;
      setTarget(null);
    };
    const clear = () => setTarget(null);
    const keyup = (event: KeyboardEvent) => {
      if (event.key !== "Escape") refresh();
    };
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("select", refresh, true);
    document.addEventListener("pointerup", refresh);
    document.addEventListener("keyup", keyup);
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", clear);
    document.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("selectionchange", refresh);
      document.removeEventListener("select", refresh, true);
      document.removeEventListener("pointerup", refresh);
      document.removeEventListener("keyup", keyup);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", clear);
      document.removeEventListener("scroll", clear, true);
    };
  }, [resolveReadingSelection]);
  if (!target) return null;
  const width = Math.min(370, window.innerWidth - 16);
  const left = Math.max(
    8,
    Math.min(target.rect.left, window.innerWidth - width - 8),
  );
  const top = Math.max(
    8,
    Math.min(
      target.rect.top >= 90 ? target.rect.top - 82 : target.rect.bottom + 8,
      window.innerHeight - 90,
    ),
  );
  return createPortal(
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      ref={toolbar}
      style={{ left, top, width }}
      onPointerDown={(event) => event.preventDefault()}
    >
      {textFormats.map((format, index) => {
        const Icon = icons[index];
        return (
          <button
            type="button"
            className="icon-button"
            key={format.name}
            aria-label={format.name}
            title={
              format.name +
              ("key" in format ? ` (Ctrl+${format.key.toUpperCase()})` : "")
            }
            onClick={() => apply(format)}
          >
            <Icon size={17} />
          </button>
        );
      })}
    </div>,
    target.field?.closest("dialog") || document.body,
  );
}
