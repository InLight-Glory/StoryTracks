import { useState } from "react";
import { Project, effective, orderedChapters } from "./domain";
import { OrganizeKind } from "./organize";

export default function OutlineOrganizer({
  project: p,
  kind,
  count,
  setKind,
  clear,
  apply,
}: {
  project: Project;
  kind: OrganizeKind;
  count: number;
  setKind: (kind: OrganizeKind) => void;
  clear: () => void;
  apply: (action: "move" | "copy" | "up" | "down", destination: string) => void;
}) {
  const [destination, setDestination] = useState("");
  return (
    <div className="outline-organizer">
      <label className="field">
        <span>Select</span>
        <select
          aria-label="Organize item type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as OrganizeKind);
            setDestination("");
          }}
        >
          <option value="nodes">Nodes</option>
          <option value="chapters">Chapters</option>
          <option value="sections">Parts</option>
        </select>
      </label>
      <div className="organizer-count">
        <strong>{count} selected</strong>
        <button className="text-button" disabled={!count} onClick={clear}>
          Clear selection
        </button>
      </div>
      {kind !== "sections" && (
        <label className="field">
          <span>Destination</span>
          <select
            aria-label="Organize destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Choose destination…</option>
            {kind === "nodes" && (
              <optgroup label="Existing chapter">
                {orderedChapters(p, true).map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={effective(p, c, "locked")}
                  >
                    {p.sections.find((s) => s.id === c.sectionId)?.title} /{" "}
                    {c.title || "Untitled chapter"}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup
              label={kind === "nodes" ? "Part → new unnamed chapter" : "Part"}
            >
              {p.sections
                .filter((s) => !s.trashed)
                .map((s) => (
                  <option
                    key={s.id}
                    value={kind === "nodes" ? "part:" + s.id : s.id}
                    disabled={s.locked}
                  >
                    {s.title || "Untitled part"}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      )}
      <div className="organizer-actions">
        {kind !== "sections" && (
          <button
            className="primary"
            disabled={!count || !destination}
            onClick={() => apply("move", destination)}
          >
            Move selected
          </button>
        )}
        <button
          className="button"
          disabled={!count || (kind !== "sections" && !destination)}
          onClick={() => apply("copy", destination)}
        >
          Copy selected
        </button>
        <button
          className="button"
          disabled={!count}
          onClick={() => apply("up", "")}
        >
          Move up
        </button>
        <button
          className="button"
          disabled={!count}
          onClick={() => apply("down", "")}
        >
          Move down
        </button>
      </div>
      <p className="hint">
        Check items below. Move up/down keeps them in their current group.
        Copies include children and connected notes.
      </p>
    </div>
  );
}
