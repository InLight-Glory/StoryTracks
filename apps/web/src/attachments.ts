import { Project } from "./domain";
import { fromBase64, hashBytes } from "./export";

const extensions: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};
export function attachmentType(
  file: Pick<File, "name" | "type">,
  resource: boolean,
) {
  let type = file.type.toLowerCase().split(";")[0].trim();
  const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
  if (["", "application/octet-stream", "binary/octet-stream"].includes(type))
    type = extensions[extension] || "";
  if (type === "audio/x-wav") type = "audio/wav";
  if (
    type === "text/x-markdown" ||
    (type === "text/plain" && ["md", "markdown"].includes(extension))
  )
    type = "text/markdown";
  const supported = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
    ...(resource ? ["application/pdf", "text/plain", "text/markdown"] : []),
  ];
  if (!supported.includes(type))
    throw new Error(
      "Use PNG, JPG, WebP, GIF, MP3, WAV, OGG, M4A or WebM. Resources also accept PDF, TXT and Markdown.",
    );
  return type;
}
export function textAttachment(bytes: Uint8Array) {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    if (encoding !== "utf-8")
      throw new Error(
        "This text file has invalid UTF-16 content. Save it as UTF-8 and try again.",
      );
    // Use an explicit CP1252 table so browser and Node decoders agree.
    const cp1252 = [
      0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6,
      0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019,
      0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a,
      0x153, 0x9d, 0x17e, 0x178,
    ];
    return Array.from(bytes, (b) =>
      String.fromCodePoint(b >= 0x80 && b <= 0x9f ? cp1252[b - 0x80] : b),
    ).join("");
  }
}
export async function attachmentDownload(asset: Project["assets"][number]) {
  const bytes = fromBase64(asset.data);
  if (bytes.length !== asset.size || (await hashBytes(bytes)) !== asset.hash)
    throw new Error(
      "This attachment is damaged. Restore its original from a backup.",
    );
  return {
    filename: asset.filename,
    blob: new Blob([bytes], { type: asset.mediaType }),
  };
}
