import { useCallback, useEffect, useRef, useState } from "react";
import { clone, Project, validateProject } from "./domain";
import { saveProject } from "./storage";
const structure = (p: Project) =>
  JSON.stringify(
    [p.sections, p.chapters, p.nodes].map((items) =>
      items.map((i) => [
        i.id,
        "chapterId" in i ? i.chapterId : "sectionId" in i ? i.sectionId : "",
        i.locked,
        i.suspended,
        i.trashed,
      ]),
    ),
  );
export function useWorkspace() {
  const [project, setProject] = useState<Project | null>(null),
    ref = useRef<Project | null>(null);
  const [status, setStatus] = useState("saved"),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const history = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    persisted = useRef(0),
    generation = useRef(0),
    savedGeneration = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    saving = useRef<Promise<void> | null>(null);
  const pending = useRef<{ snapshot: Project; generation: number }[]>([]);
  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (saving.current) {
      await saving.current;
      if (savedGeneration.current < generation.current) return flush();
      return;
    }
    if (!ref.current || savedGeneration.current === generation.current) return;
    const queued = pending.current[0];
    const snapshot = queued?.snapshot ?? clone(ref.current),
      gen = queued?.generation ?? generation.current;
    setStatus("saving");
    saving.current = (async () => {
      try {
        const saved = await saveProject(snapshot, persisted.current);
        persisted.current = saved.revision;
        savedGeneration.current = gen;
        if (queued) pending.current.shift();
        if (ref.current?.id === saved.id) {
          ref.current = {
            ...ref.current,
            revision: saved.revision,
            updatedAt: saved.updatedAt,
          };
          setProject(ref.current);
        }
        setStatus(
          savedGeneration.current === generation.current ? "saved" : "saving",
        );
        setError("");
      } catch (e) {
        setStatus("failed");
        setError((e as Error).message);
        throw e;
      } finally {
        saving.current = null;
      }
    })();
    await saving.current;
    if (savedGeneration.current < generation.current) return flush();
  }, []);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush().catch(() => {}), 500);
  }, [flush]);
  const open = useCallback(
    async (p: Project | null) => {
      await flush();
      ref.current = p;
      setProject(p);
      persisted.current = p?.revision || 0;
      generation.current = 0;
      savedGeneration.current = 0;
      history.current = [];
      future.current = [];
      pending.current = [];
      setStatus("saved");
      setError("");
      setVersion((v) => v + 1);
    },
    [flush],
  );
  const change = useCallback(
    (mutate: (p: Project) => void) => {
      if (!ref.current) return;
      const before = ref.current,
        next = clone(before);
      mutate(next);
      validateProject(next);
      if (JSON.stringify(before) === JSON.stringify(next)) return;
      history.current.push(before);
      if (history.current.length > 100) history.current.shift();
      future.current = [];
      ref.current = next;
      setProject(next);
      generation.current++;
      setStatus("saving");
      setVersion((v) => v + 1);
      if (structure(before) !== structure(next)) {
        pending.current.push({
          snapshot: clone(next),
          generation: generation.current,
        });
        void flush().catch(() => {});
      } else schedule();
    },
    [schedule, flush],
  );
  const travel = useCallback(
    (redo = false) => {
      const from = redo ? future.current : history.current,
        to = redo ? history.current : future.current,
        next = from.pop();
      if (!next || !ref.current) return;
      const before = ref.current;
      to.push(before);
      ref.current = { ...next, revision: persisted.current };
      setProject(ref.current);
      generation.current++;
      setStatus("saving");
      setVersion((v) => v + 1);
      if (structure(before) !== structure(next)) {
        pending.current.push({
          snapshot: clone(ref.current),
          generation: generation.current,
        });
        void flush().catch(() => {});
      } else schedule();
    },
    [schedule, flush],
  );
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (generation.current !== savedGeneration.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  return {
    project,
    ref,
    status,
    error,
    version,
    open,
    change,
    flush,
    undo: () => travel(),
    redo: () => travel(true),
    canUndo: history.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
