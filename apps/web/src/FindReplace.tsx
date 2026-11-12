import { useEffect, useMemo, useRef, useState } from "react";
import { Project } from "./domain";
import { findMatches, replaceMatches, FindOptions } from "./find";
import { X } from "lucide-react";

export default function FindReplace({
  project,
  change,
  reveal,
  query,
  setQuery,
  within,
  replaceInitially,
}: {
  project: Project;
  change: (fn: (p: Project) => void) => void;
  reveal: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  within: string;
  replaceInitially: boolean;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => searchInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const [options, setOptions] = useState<FindOptions>({
    query,
    matchCase: false,
    wholeWord: false,
    scope: "story",
    within,
  });
  const [showReplace, setShowReplace] = useState(replaceInitially);
  useEffect(() => setShowReplace(replaceInitially), [replaceInitially]);
  const [replacement, setReplacement] = useState(""),
    [index, setIndex] = useState(0),
    [message, setMessage] = useState("");
  const matches = useMemo(
    () => findMatches(project, options),
    [project, options],
  );
  const current = matches[Math.min(index, Math.max(0, matches.length - 1))];
  const editable = matches.filter((m) => !m.readonly).length;
  const configure = (patch: Partial<FindOptions>) => {
    setOptions({ ...options, ...patch });
    if (patch.query !== undefined) setQuery(patch.query);
    setIndex(0);
    setMessage("");
  };
  const replace = (all: boolean) =>
    change((d) => {
      const count = replaceMatches(
        d,
        options,
        replacement,
        all ? undefined : current?.key,
      );
      setMessage(
        `Replaced ${count} occurrence${count === 1 ? "" : "s"}. Undo restores this change.`,
      );
    });
  return (
    <div className="find-workspace">
      <div className="field">
        <label htmlFor="find-query">Find text</label>
        <div className="find-input-row">
          <input
            id="find-query"
            ref={searchInput}
            autoFocus
            value={options.query}
            onChange={(e) => configure({ query: e.target.value })}
          />
          {options.query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => {
                configure({ query: "" });
                searchInput.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <label className="replace-toggle">
        <input
          type="checkbox"
          checked={showReplace}
          onChange={(e) => setShowReplace(e.target.checked)}
        />{" "}
        Replace
      </label>
      {showReplace && (
        <label className="field">
          <span>Replace with</span>
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </label>
      )}
      <div className="find-options">
        <label>
          <input
            type="checkbox"
            checked={options.matchCase}
            onChange={(e) => configure({ matchCase: e.target.checked })}
          />{" "}
          Match case
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.wholeWord}
            onChange={(e) => configure({ wholeWord: e.target.checked })}
          />{" "}
          Whole words
        </label>
      </div>
      <label className="field">
        <span>Search in</span>
        <select
          aria-label="Search in"
          value={options.within || ""}
          onChange={(e) => configure({ within: e.target.value })}
        >
          <option value="">Whole book</option>
          <optgroup label="Parts">
            {project.sections
              .filter((s) => !s.trashed)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled part"}
                </option>
              ))}
          </optgroup>
          <optgroup label="Chapters">
            {project.chapters
              .filter(
                (c) =>
                  !c.trashed &&
                  !project.sections.find((s) => s.id === c.sectionId)?.trashed,
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {project.sections.find((s) => s.id === c.sectionId)?.title} /{" "}
                  {c.title || "Untitled chapter"}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      <label className="field">
        <span>Search scope</span>
        <select
          value={options.scope}
          onChange={(e) =>
            configure({ scope: e.target.value as FindOptions["scope"] })
          }
        >
          <option value="story">Story titles and node text</option>
          <option value="all">Story, notes, resources and workbook</option>
        </select>
      </label>
      <p role="status">
        {options.query
          ? showReplace
            ? `${matches.length} matches · ${editable} replaceable`
            : `${matches.length} matches`
          : "Enter text to search your project."}
      </p>
      <p className="hint">
        Includes suspended content; excludes trash. Locked content and linked
        template placements are searchable but cannot be replaced here.
      </p>
      {current && (
        <div className="find-current">
          <small>
            {current.label}
            {current.readonly ? " · read only" : ""}
          </small>
          <p>
            {current.text.slice(Math.max(0, current.start - 90), current.start)}
            <mark>{current.text.slice(current.start, current.end)}</mark>
            {current.text.slice(current.end, current.end + 160)}
          </p>
        </div>
      )}
      <div className="find-actions">
        <button
          className="button"
          disabled={!matches.length}
          onClick={() =>
            setIndex(
              (Math.min(index, matches.length - 1) - 1 + matches.length) %
                matches.length,
            )
          }
        >
          Previous match
        </button>
        <button
          className="button"
          disabled={!matches.length}
          onClick={() =>
            setIndex((Math.min(index, matches.length - 1) + 1) % matches.length)
          }
        >
          Next match
        </button>
        {current?.nodeId && (
          <button className="button" onClick={() => reveal(current.nodeId!)}>
            Show node
          </button>
        )}
      </div>
      {showReplace && (
        <div className="modal-footer">
          <button
            className="button"
            disabled={!current || current.readonly}
            onClick={() => replace(false)}
          >
            Replace match
          </button>
          <button
            className="primary"
            disabled={!editable}
            onClick={() => replace(true)}
          >
            Replace all ({editable})
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
