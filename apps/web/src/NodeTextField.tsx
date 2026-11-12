import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { useTextFormatting } from "./SelectionToolbar";

export default function NodeTextField({
  initialHeight,
  value,
  onValueChange,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  initialHeight?: number;
  onValueChange?: (text: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useTextFormatting(field, onValueChange);
  const previousValue = useRef(value);
  useLayoutEffect(() => {
    if (value === previousValue.current && initialHeight !== undefined) return;
    const element = field.current!;
    element.style.height = "0px";
    element.style.height = `${Math.max(initialHeight || 0, element.scrollHeight)}px`;
    previousValue.current = value;
  }, [value, initialHeight]);
  return (
    <textarea
      {...props}
      ref={field}
      value={value}
      onChange={
        onValueChange
          ? (event) => onValueChange(event.target.value)
          : props.onChange
      }
      style={{
        ...props.style,
        height: initialHeight === undefined ? undefined : `${initialHeight}px`,
      }}
    />
  );
}
