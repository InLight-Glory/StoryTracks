import { z } from "zod";

const coordinate = z.number().finite().min(0).max(100000);
export const inkSchema = z.object({
  width: z.number().finite().min(1).max(100000),
  height: z.number().finite().min(1).max(100000),
  strokes: z
    .array(
      z.object({
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        width: z.number().finite().min(0.5).max(40),
        points: z
          .array(z.tuple([coordinate, coordinate]))
          .min(1)
          .max(2048),
      }),
    )
    .max(2000),
});
export type InkPage = z.infer<typeof inkSchema>;
export type InkStroke = InkPage["strokes"][number];
export type InkPoint = InkStroke["points"][number];
export const blankPage = (): InkPage => ({
  width: 1000,
  height: 1400,
  strokes: [],
});
export function validateInk(page: InkPage) {
  if (
    page.strokes.reduce((count, stroke) => count + stroke.points.length, 0) >
    200000
  )
    throw new Error(
      "This drawing has reached its point limit. Start another page.",
    );
  for (const stroke of page.strokes)
    if (stroke.points.some(([x, y]) => x > page.width || y > page.height))
      throw new Error("Drawing point is outside its page.");
}
export function strokeHit(stroke: InkStroke, point: InkPoint, radius = 12) {
  const distance = (a: InkPoint, b: InkPoint) =>
    Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (stroke.points.length === 1)
    return distance(stroke.points[0], point) <= radius + stroke.width / 2;
  return stroke.points.slice(1).some((b, i) => {
    const a = stroke.points[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    return (
      distance([a[0] + t * dx, a[1] + t * dy], point) <=
      radius + stroke.width / 2
    );
  });
}

// Export uses a fixed white page, independent of the application's color theme.
export function inkPng(page: InkPage): string {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 2048 / Math.max(page.width, page.height));
  canvas.width = Math.max(1, Math.round(page.width * scale));
  canvas.height = Math.max(1, Math.round(page.height * scale));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Drawing export is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(canvas.width / page.width, canvas.height / page.height);
  context.lineCap = context.lineJoin = "round";
  for (const stroke of page.strokes) {
    context.fillStyle = context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(...stroke.points[0], stroke.width / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(...stroke.points[0]);
      for (const point of stroke.points.slice(1)) context.lineTo(...point);
      context.stroke();
    }
  }
  return canvas.toDataURL("image/png").split(",")[1];
}
