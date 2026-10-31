import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  clone,
  defaults,
  Project,
  resolvedBlocks,
  StoryNode,
  textBlock,
  uid,
} from "./domain";
type Template = Project["templates"][number];
export default function TemplateEditor({
  project,
  template,
  source,
  onSave,
  onClose,
}: {
  project: Project;
  template?: Template;
  source?: StoryNode;
  onSave: (value: Template) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Template>(() =>
    template
      ? clone(template)
      : {
          id: uid(),
          name: source?.title || "New template",
          title: source?.title || "",
          blocks: source
            ? clone(resolvedBlocks(project, source)).map((b) => ({
                ...b,
                id: uid(),
              }))
            : [textBlock()],
          importance: source?.importance ?? defaults.importance,
          liberty: source?.liberty ?? defaults.liberty,
          beginning: source?.beginning ?? 50,
          ending: source?.ending ?? 50,
        },
  );
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const update = (fn: (t: Template) => void) =>
    setDraft((value) => {
      const copy = clone(value);
      fn(copy);
      return copy;
    });
  const linked = template
    ? project.nodes.filter((n) => n.templateId === template.id)
    : [];
  return (
    <dialog ref={dialog} className="modal wide" onCancel={onClose}>
      <div className="modal-head">
        <div>
          <h2>
            {template
              ? "Edit a recurring thread."
              : "Keep this thread for later."}
          </h2>
          <p>
            {template
              ? `${linked.length} placements share this content. Existing placement weights stay unchanged.`
              : "Place this content throughout your story, with independent weights."}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(draft);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="template-fields">
          <label className="field">
            <span>Template name</span>
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(e) => update((t) => (t.name = e.target.value))}
            />
          </label>
          <label className="field">
            <span>Node title (optional)</span>
            <input
              value={draft.title}
              onChange={(e) => update((t) => (t.title = e.target.value))}
            />
          </label>
        </div>
        <label className="field">
          <span>Description / tags</span>
          <input
            value={draft.description || ""}
            placeholder="A refrain, a motif, a reminder…"
            onChange={(e) => update((t) => (t.description = e.target.value))}
          />
        </label>
        <div className="eyebrow">ORDERED CONTENT</div>
        {draft.blocks.map((b, i) => (
          <div className="template-block" key={b.id}>
            {b.type === "text" ? (
              <textarea
                aria-label={`Template text ${i + 1}`}
                value={b.text}
                onChange={(e) =>
                  update((t) => (t.blocks[i].text = e.target.value))
                }
              />
            ) : (
              <div>
                <small>
                  {b.type.toUpperCase()} ·{" "}
                  {project.assets.find((a) => a.id === b.assetId)?.filename}
                </small>
                <input
                  aria-label="Template media caption"
                  placeholder="Caption"
                  value={b.caption}
                  onChange={(e) =>
                    update((t) => (t.blocks[i].caption = e.target.value))
                  }
                />
              </div>
            )}
            <div className="template-block-tools">
              <button
                type="button"
                className="icon-button"
                aria-label="Move template block up"
                disabled={!i}
                onClick={() =>
                  update((t) => {
                    [t.blocks[i - 1], t.blocks[i]] = [
                      t.blocks[i],
                      t.blocks[i - 1],
                    ];
                  })
                }
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Move template block down"
                disabled={i === draft.blocks.length - 1}
                onClick={() =>
                  update((t) => {
                    [t.blocks[i + 1], t.blocks[i]] = [
                      t.blocks[i],
                      t.blocks[i + 1],
                    ];
                  })
                }
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove template block"
                onClick={() => update((t) => t.blocks.splice(i, 1))}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() => update((t) => t.blocks.push(textBlock()))}
        >
          <Plus size={14} />
          Add text block
        </button>
        <div className="template-defaults">
          {(["importance", "liberty", "beginning", "ending"] as const).map(
            (k) => (
              <label className="field" key={k}>
                <span>{k[0].toUpperCase() + k.slice(1)} default</span>
                <input
                  type="number"
                  required
                  min={k === "importance" || k === "liberty" ? 1 : 0}
                  max={k === "importance" || k === "liberty" ? 5.5 : 100}
                  step={k === "importance" || k === "liberty" ? 0.5 : 1}
                  value={
                    draft[k] / (k === "importance" || k === "liberty" ? 2 : 1)
                  }
                  onChange={(e) =>
                    update(
                      (t) =>
                        (t[k] =
                          Number(e.target.value) *
                          (k === "importance" || k === "liberty" ? 2 : 1)),
                    )
                  }
                />
              </label>
            ),
          )}
        </div>
        {linked.length > 0 && (
          <p className="small-note">
            Affected chapters:{" "}
            {[
              ...new Set(
                linked.map(
                  (n) =>
                    project.chapters.find((c) => c.id === n.chapterId)?.title,
                ),
              ),
            ].join(", ")}
          </p>
        )}
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!draft.name.trim()}>
            Save template
          </button>
        </div>
      </form>
    </dialog>
  );
}
