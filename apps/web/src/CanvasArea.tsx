import {
  Link2,
  LockKeyhole,
  Plus,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import {
  addCanvasNote,
  editCanvasNote,
  effective,
  nodeTitle,
  orderedNodes,
  type Project,
  type StoryNode,
} from "./domain";

export default function CanvasArea({
  project,
  area,
  selected,
  selectNode,
  change,
}: {
  project: Project;
  area: "subcontext" | "highlight";
  selected?: StoryNode;
  selectNode: (node: StoryNode, focus?: boolean) => void;
  change: (mutate: (project: Project) => void) => void;
}) {
  const context = area === "subcontext",
    title = context ? "Sub-context" : "Highlight";
  const node =
    selected && !effective(project, selected, "trashed") ? selected : undefined;
  const locked = !!node && effective(project, node, "locked");
  const notes = project.notes.filter(
    (n) => n.canvasArea === area && n.ownerId === node?.id,
  );
  const unlinked = project.notes.filter(
    (n) => n.canvasArea === area && n.ownerId === project.id,
  );
  const choices = orderedNodes(project, true);
  const Icon = context ? StickyNote : Sparkles;
  const renderNote = (
    note: Project["notes"][number],
    index: number,
    legacy = false,
  ) => {
    const disabled = !legacy && locked;
    const label = legacy
      ? `Unlinked ${title.toLowerCase()} note ${index + 1}`
      : `${title} note ${index + 1}`;
    const update = (patch: Partial<typeof note> | null) =>
      change((p) => editCanvasNote(p, note.id, patch));
    return (
      <section
        className={`canvas-note ${legacy ? "unlinked-note" : ""}`}
        key={note.id}
      >
        <div className="canvas-note-top">
          <span>
            {legacy ? "UNLINKED" : String(index + 1).padStart(2, "0")}
          </span>
          <button
            className="icon-button"
            disabled={disabled}
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={() => update(null)}
          >
            <X size={13} />
          </button>
        </div>
        <label className="note-node-label">
          <Link2 size={11} />
          {legacy ? "Connect to a node" : "Connected to node"}
          <select
            aria-label={`${label} connected node`}
            disabled={disabled}
            value={note.ownerId}
            onChange={(e) => update({ ownerId: e.target.value })}
          >
            {legacy && <option value={project.id}>Choose a node…</option>}
            {choices.map((n) => (
              <option
                key={n.id}
                value={n.id}
                disabled={effective(project, n, "locked")}
              >
                {nodeTitle(project, n)}
              </option>
            ))}
          </select>
        </label>
        <input
          aria-label={`${label} title`}
          disabled={disabled}
          placeholder={
            context ? "A thought or feeling…" : "A comment on this moment…"
          }
          value={note.title || ""}
          onChange={(e) => update({ title: e.target.value })}
        />
        <textarea
          aria-label={label}
          disabled={disabled}
          placeholder={
            context
              ? "What do you think or feel about this node? What lies beneath it?"
              : "What would you like to say about this node? Add your commentary…"
          }
          value={note.text}
          onChange={(e) => update({ text: e.target.value })}
        />
        <label className="canvas-note-inclusion">
          <input
            type="checkbox"
            disabled={disabled}
            checked={note.include}
            onChange={(e) => update({ include: e.target.checked })}
          />
          Include in publication
        </label>
      </section>
    );
  };
  return (
    <aside
      className={`canvas-area ${area} ${node ? "has-connected-node" : ""}`}
      aria-label={`${title} canvas area`}
    >
      <header className="canvas-area-heading">
        <span className="eyebrow">
          {context ? "01 / THOUGHTS & FEELINGS" : "03 / AUTHOR’S COMMENTARY"}
        </span>
        <div>
          <Icon size={17} />
          <h2>{title}</h2>
          <span className="count">{notes.length}</span>
        </div>
        <p>
          {context
            ? "Your thoughts and feelings about a node."
            : "Your comments and commentary on a node."}
        </p>
      </header>
      <div className="canvas-node-connection">
        <label>
          <Link2 size={12} />
          {node ? "CONNECTED NODE" : "CHOOSE A NODE"}
          <select
            aria-label={`${title} connected node`}
            value={node?.id || ""}
            onChange={(e) => {
              const n = project.nodes.find((n) => n.id === e.target.value);
              if (n) selectNode(n, true);
            }}
          >
            <option value="" disabled>
              Select a node…
            </option>
            {choices.map((n) => (
              <option key={n.id} value={n.id}>
                {nodeTitle(project, n)}
              </option>
            ))}
          </select>
        </label>
        {locked && (
          <small>
            <LockKeyhole size={11} />
            Unlock this node to edit its notes.
          </small>
        )}
      </div>
      <div className="canvas-area-notes">
        {notes.map((note, i) => renderNote(note, i))}
        {!notes.length && (
          <div className="canvas-area-empty">
            <Icon size={26} strokeWidth={1} />
            <p>
              {!node
                ? "Select a node to connect your notes."
                : context
                  ? "What does this moment make you think or feel?"
                  : "What would you add about this moment?"}
            </p>
            <small>
              {node
                ? "These notes stay connected to this node."
                : "Choose a node here or on the main canvas."}
            </small>
          </div>
        )}
      </div>
      <button
        className="canvas-area-add"
        disabled={!node || locked}
        onClick={() => change((p) => addCanvasNote(p, node!.id, area))}
      >
        <Plus size={14} />
        {context ? "Add sub-context" : "Add highlight"}
      </button>
      {!!unlinked.length && (
        <details className="unlinked-notes">
          <summary>Unlinked notes ({unlinked.length})</summary>
          <p>
            Your earlier notes are preserved. Choose a node on each note to
            connect it.
          </p>
          {unlinked.map((note, i) => renderNote(note, i, true))}
        </details>
      )}
    </aside>
  );
}
