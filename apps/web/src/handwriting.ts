import { assertEditable, uid, type Project } from "./domain";
import { fromBase64, hashBytes } from "./export";
import { inkPng, type InkPage } from "./ink";

export async function drawingAsset(
  page: InkPage,
): Promise<Project["assets"][number]> {
  const data = inkPng(page),
    bytes = fromBase64(data);
  return {
    id: uid(),
    filename: "hand-written.png",
    mediaType: "image/png",
    data,
    size: bytes.length,
    hash: await hashBytes(bytes),
  };
}
export function saveDrawing(
  p: Project,
  nodeId: string,
  page: InkPage,
  asset: Project["assets"][number],
) {
  const node = p.nodes.find((n) => n.id === nodeId);
  if (!node || node.kind !== "handwritten" || node.templateId)
    throw new Error("This writing page is no longer editable.");
  assertEditable(p, node);
  let block = node.blocks.find((b) => b.drawing);
  const oldAsset = block?.assetId;
  if (!block) {
    block = {
      id: uid(),
      type: "image",
      text: "",
      alt: "Hand written page",
      caption: "",
    };
    node.blocks.push(block);
  }
  block.drawing = page;
  block.assetId = asset.id;
  p.assets.push(asset);
  // Never overwrite a shared asset: a copied or locked node may still use it.
  if (
    oldAsset &&
    ![...p.nodes, ...p.templates].some((n) =>
      n.blocks.some((b) => b.assetId === oldAsset),
    ) &&
    !p.resources.some((r) => r.assetId === oldAsset)
  )
    p.assets = p.assets.filter((a) => a.id !== oldAsset);
}
