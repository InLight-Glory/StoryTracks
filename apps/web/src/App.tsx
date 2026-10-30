import ReactMarkdown from "react-markdown";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Copy,
  Download,
  Eye,
  FileText,
  FolderOpen,
  GripVertical,
  ImagePlus,
  Layers,
  LayoutGrid,
  Link2,
  List,
  LoaderCircle,
  LockKeyhole,
  Map,
  Maximize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Pause,
  Plus,
  Redo2,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  Trash2,
  Undo2,
  UnlockKeyhole,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  active,
  ancestors,
  assertEditable,
  Block,
  chapterLabel,
  clone,
  defaults,
  demoProject,
  detach,
  duplicateProject,
  effective,
  effectiveMetadata,
  getItem,
  importText,
  Item,
  metadataFields,
  metadataLabels,
  moveItem,
  newChapter,
  newNode,
  newProject,
  newSection,
  nodeTitle,
  orderedChapters,
  orderedNodes,
  Project,
  resolvedBlocks,
  setState,
  splitText,
  StoryNode,
  textBlock,
  uid,
} from "./domain";
import {
  archiveBlob,
  hashBytes,
  publication,
  publishBlob,
  readArchive,
  sharpness,
  toBase64,
  wordCount,
} from "./export";
import {
  deleteProject,
  deliver,
  edition,
  listProjects,
  login,
  saveProject,
  publishProject,
  session,
} from "./storage";
import { useWorkspace } from "./useWorkspace";

type Modal =
  | "new"
  | "import"
  | "publish"
  | "trash"
  | "help"
  | "rename"
  | "template"
  | "resource"
  | null;
type Tab = "node" | "chapter" | "project" | "notes" | "resources" | "templates";
type ViewState = {
  selected: string;
  chapter: string;
  zoom: number;
  left: boolean;
  right: boolean;
  all: boolean;
  collapsed: string[];
  leftWidth: number;
  rightWidth: number;
  scroll: number;
};
const initialView: ViewState = {
  selected: "",
  chapter: "",
  zoom: 100,
  left: true,
  right: true,
  all: false,
  collapsed: [],
  leftWidth: 264,
  rightWidth: 310,
  scroll: 0,
};
const icons = {
  beat: Circle,
  scene: FileText,
  note: StickyNote,
  turn: Sparkles,
};
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "wide" : ""}`}
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const w = useWorkspace(),
    p = w.project;
  const [loading, setLoading] = useState(true),
    [authenticated, setAuthenticated] = useState(true),
    [password, setPassword] = useState("");
  const [projects, setProjects] = useState<Project[]>([]),
    [view, setView] = useState<ViewState>(() => ({
      ...initialView,
      left: window.innerWidth > 760,
      right: window.innerWidth > 760,
    })),
    [tab, setTab] = useState<Tab>("node");
  const [modal, setModal] = useState<Modal>(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [projectSearch, setProjectSearch] = useState(""),
    [sort, setSort] = useState("recent");
  const [sectionSettings, setSectionSettings] = useState("");
  const [menu, setMenu] = useState(false),
    [showSuspended, setShowSuspended] = useState(false),
    [editing, setEditing] = useState(""),
    [listView, setListView] = useState(false);
  const [formName, setFormName] = useState(""),
    [formText, setFormText] = useState(""),
    [importType, setImportType] = useState("outline"),
    [titleLine, setTitleLine] = useState(false),
    [includeSuspended, setIncludeSuspended] = useState(false),
    [busy, setBusy] = useState(false);
  const [noteScope, setNoteScope] = useState("project"),
    [templateEdit, setTemplateEdit] = useState(""),
    [resourceId, setResourceId] = useState("");
  const canvas = useRef<HTMLDivElement>(null),
    archiveInput = useRef<HTMLInputElement>(null),
    mediaInput = useRef<HTMLInputElement>(null),
    resourceInput = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    pan = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null),
    space = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6500);
  };
  const run = async (action: () => unknown | Promise<unknown>) => {
    try {
      return await action();
    } catch (e) {
      notify((e as Error).message);
      return undefined;
    }
  };
  const change = (fn: (p: Project) => void) => {
    try {
      w.change(fn);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const updateView = (patch: Partial<ViewState>) =>
    setView((v) => ({ ...v, ...patch }));
  async function refresh() {
    const all = await listProjects();
    setProjects(all);
    return all;
  }
  async function openProject(project: Project | null) {
    await w.open(project);
    setEditing("");
    setSearch("");
    setMenu(false);
    if (project) {
      let saved: Partial<ViewState> = {};
      try {
        saved = JSON.parse(
          localStorage.getItem("storytracks-ui-" + project.id) || "{}",
        );
      } catch {}
      const chapter = orderedChapters(project)[0]?.id || "";
      setView({
        ...initialView,
        left: window.innerWidth > 760,
        right: window.innerWidth > 760,
        chapter,
        selected: project.nodes.find((n) => n.chapterId === chapter)?.id || "",
        ...saved,
      });
      localStorage.setItem("storytracks-last", project.id);
    } else {
      localStorage.removeItem("storytracks-last");
      await refresh();
    }
  }
  async function boot() {
    const s = await session();
    if (!s.authenticated) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    setAuthenticated(true);
    const all = await refresh();
    if (!all.length && !localStorage.getItem("storytracks-initialized")) {
      const demo = await saveProject(demoProject(), 0);
      localStorage.setItem("storytracks-initialized", "1");
      setProjects([demo]);
      await openProject(demo);
    } else {
      const last = all.find(
        (x) => x.id === localStorage.getItem("storytracks-last"),
      );
      if (last) await openProject(last);
    }
    setLoading(false);
  }
  const booted = useRef(false);
  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      void boot().catch((e) => {
        setLoading(false);
        notify(e.message);
      });
    }
  }, []);
  useEffect(() => {
    if (p) localStorage.setItem("storytracks-ui-" + p.id, JSON.stringify(view));
  }, [view, p?.id]);
  useEffect(() => {
    if (canvas.current) canvas.current.scrollTop = view.scroll;
  }, [p?.id]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).closest(
        "input,textarea,[contenteditable]",
      );
      if (e.code === "Space" && !input) {
        space.current = true;
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !input) {
        e.preventDefault();
        e.shiftKey ? w.redo() : w.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void run(() => w.flush());
      }
      if (e.key === "Escape") {
        setEditing("");
        setMenu(false);
      }
    };
    const up = () => (space.current = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [w.undo, w.redo]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setView((v) => ({
          ...v,
          zoom: Math.max(25, Math.min(200, v.zoom + (e.deltaY < 0 ? 5 : -5))),
        }));
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [p?.id]);
  const selected = p?.nodes.find((n) => n.id === view.selected),
    chapter =
      p?.chapters.find((c) => c.id === view.chapter) ||
      (p ? orderedChapters(p)[0] : undefined);
  const locked = !!(p && selected && effective(p, selected, "locked"));
  const nodes = p
    ? orderedNodes(p, showSuspended).filter(
        (n) =>
          (view.all || n.chapterId === chapter?.id) &&
          (!search ||
            nodeTitle(p, n).toLowerCase().includes(search.toLowerCase()) ||
            resolvedBlocks(p, n).some((b) =>
              b.text.toLowerCase().includes(search.toLowerCase()),
            )),
      )
    : [];
  const scopeId = p
    ? noteScope === "node"
      ? selected?.id
      : noteScope === "chapter"
        ? chapter?.id
        : p.id
    : undefined;
  const note = p?.notes.find((n) => n.ownerId === scopeId);
  function selectNode(n: StoryNode, focus = false) {
    updateView({ selected: n.id, chapter: n.chapterId });
    setTab("node");
    if (p && effective(p, n, "suspended")) setShowSuspended(true);
    if (focus) {
      updateView({ selected: n.id, chapter: n.chapterId, zoom: 100 });
      setTimeout(
        () =>
          document
            .getElementById("node-" + n.id)
            ?.scrollIntoView({
              block: "start",
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            }),
        80,
      );
    }
  }
  function addNode(after?: string) {
    if (!chapter || !p) return;
    let id = "";
    change((d) => {
      const c = d.chapters.find((c) => c.id === chapter.id)!;
      assertEditable(d, c);
      const n = newNode(c.id);
      id = n.id;
      const index = after ? d.nodes.findIndex((n) => n.id === after) : -1;
      if (index >= 0) d.nodes.splice(index + 1, 0, n);
      else d.nodes.push(n);
    });
    if (id) {
      updateView({ selected: id });
      setEditing(id);
      setTab("node");
      setTimeout(
        () =>
          document
            .getElementById("node-" + id)
            ?.scrollIntoView({ block: "center", behavior: "smooth" }),
        80,
      );
    }
  }
  function editNode(id: string, fn: (n: StoryNode, d: Project) => void) {
    change((d) => {
      const n = d.nodes.find((n) => n.id === id)!;
      assertEditable(d, n);
      fn(n, d);
    });
  }
  function startModal(type: Modal) {
    setFormName("");
    setFormText("");
    setModal(type);
    setMenu(false);
  }
  async function create() {
    if (!formName.trim()) return;
    setBusy(true);
    await run(async () => {
      const next = await saveProject(newProject(formName, formText), 0);
      await openProject(next);
      setModal(null);
      notify("Your new story starts here.");
    });
    setBusy(false);
  }
  async function backup() {
    if (!p) return;
    await w.flush();
    await deliver(await archiveBlob(w.ref.current!));
    notify("Project backup ready. It includes suspended material and trash.");
  }
  async function importArchive(file: File) {
    setBusy(true);
    await run(async () => {
      let incoming = await readArchive(file);
      const all = await refresh();
      if (all.some((x) => x.id === incoming.id)) {
        incoming = duplicateProject(incoming);
        notify(
          "Imported as an independent copy because this project already exists.",
        );
      }
      incoming.revision = 0;
      const saved = await saveProject(incoming, 0);
      await openProject(saved);
    });
    setBusy(false);
  }
  async function addMedia(file: File, resource = false) {
    if (!p) return;
    const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"],
      audioTypes = [
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/mp4",
        "audio/webm",
      ];
    if (
      !(
        resource
          ? [
              ...imageTypes,
              ...audioTypes,
              "application/pdf",
              "text/plain",
              "text/markdown",
            ]
          : [...imageTypes, ...audioTypes]
      ).includes(file.type)
    )
      throw new Error(
        "Use PNG, JPG, WebP, GIF, MP3, WAV, OGG or M4A. Resources also accept PDF and text.",
      );
    if (file.size > 25 * 1024 * 1024)
      throw new Error("Each attachment must be 25 MB or smaller.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = {
      id: uid(),
      filename: file.name,
      mediaType: file.type === "audio/x-wav" ? "audio/wav" : file.type,
      data: toBase64(bytes),
      hash: await hashBytes(bytes),
      size: file.size,
    };
    change((d) => {
      if (resource) {
        d.resources.push({
          id: uid(),
          title: file.name,
          kind: "reference",
          text: "",
          source: file.name,
          createdAt: new Date().toISOString(),
          include: false,
          assetId: asset.id,
        });
      } else {
        const n = d.nodes.find((n) => n.id === view.selected);
        if (!n) throw new Error("Select a node first.");
        assertEditable(d, n);
        if (n.templateId)
          throw new Error("Detach this placement before editing its media.");
        n.blocks.push({
          id: uid(),
          type: file.type.startsWith("image/") ? "image" : "audio",
          assetId: asset.id,
          text: "",
          caption: "",
          alt: "",
        });
      }
      d.assets.push(asset);
    });
  }
  function toggleCollapse(id: string) {
    updateView({
      collapsed: view.collapsed.includes(id)
        ? view.collapsed.filter((x) => x !== id)
        : [...view.collapsed, id],
    });
  }
  function resize(side: "left" | "right", e: React.PointerEvent) {
    const start = e.clientX,
      width = side === "left" ? view.leftWidth : view.rightWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.currentTarget;
    const move = (ev: Event) => {
      const x = (ev as PointerEvent).clientX;
      setView((v) => ({
        ...v,
        [side === "left" ? "leftWidth" : "rightWidth"]: Math.max(
          220,
          Math.min(440, width + (side === "left" ? x - start : start - x)),
        ),
      }));
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  }
  function itemActions(item: Item) {
    return (
      <div className="item-actions">
        <IconButton
          label="Move up"
          onClick={() => change((d) => moveItem(d, item.id, -1))}
        >
          <ArrowUp size={13} />
        </IconButton>
        <IconButton
          label="Move down"
          onClick={() => change((d) => moveItem(d, item.id, 1))}
        >
          <ArrowDown size={13} />
        </IconButton>
        <IconButton
          label={item.locked ? "Unlock" : "Lock"}
          onClick={() =>
            change((d) => setState(d, item.id, "locked", !item.locked))
          }
        >
          {item.locked ? (
            <LockKeyhole size={13} />
          ) : (
            <UnlockKeyhole size={13} />
          )}
        </IconButton>
        <IconButton
          label={item.suspended ? "Resume" : "Suspend"}
          onClick={() =>
            change((d) => setState(d, item.id, "suspended", !item.suspended))
          }
        >
          <Pause size={13} />
        </IconButton>
        <IconButton
          label="Move to trash"
          onClick={() => change((d) => setState(d, item.id, "trashed", true))}
        >
          <Trash2 size={13} />
        </IconButton>
      </div>
    );
  }
  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Map />
        </div>
        <h2>Opening your writing desk</h2>
        <LoaderCircle className="spin" />
      </div>
    );
  if (!authenticated)
    return (
      <main className="login">
        <div className="brand">
          <Map /> StoryTracks
        </div>
        <h1>Your stories, kept close.</h1>
        <p>Sign in to this StoryTracks installation.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await login(password);
              await boot();
            });
          }}
        >
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <button className="primary">
            Open writing desk <ArrowRight size={16} />
          </button>
        </form>
        {toast && <p role="alert">{toast}</p>}
      </main>
    );
  return (
    <div className="app">
      <input
        hidden
        type="file"
        ref={archiveInput}
        accept=".storytracks,.zip"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importArchive(file);
          e.target.value = "";
        }}
      />
      <input
        hidden
        type="file"
        ref={mediaInput}
        accept="image/png,image/jpeg,image/webp,image/gif,audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(() => addMedia(file));
          e.target.value = "";
        }}
      />
      <input
        hidden
        type="file"
        ref={resourceInput}
        accept="image/*,audio/*,.pdf,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(() => addMedia(file, true));
          e.target.value = "";
        }}
      />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => void run(() => openProject(null))}
        >
          <span className="brand-mark">
            <Map size={21} />
          </span>
          StoryTracks<span className="beta">LOCAL</span>
        </button>
        {p ? (
          <>
            <div className="breadcrumb">
              <span className="divider" />
              <button onClick={() => void run(() => openProject(null))}>
                My projects
              </button>
              <ChevronRight size={13} />
              <span>{p.name}</span>
              <button
                className="icon-button"
                aria-label="Project menu"
                onClick={() => setMenu(!menu)}
              >
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="dropdown">
                  <button
                    onClick={() => {
                      setFormName(p.name);
                      setModal("rename");
                      setMenu(false);
                    }}
                  >
                    Rename project
                  </button>
                  <button
                    onClick={() =>
                      void run(async () => {
                        await w.flush();
                        const copy = await saveProject(
                          duplicateProject(w.ref.current!),
                          0,
                        );
                        await openProject(copy);
                      })
                    }
                  >
                    <Copy size={15} />
                    Duplicate project
                  </button>
                  <button onClick={() => void run(backup)}>
                    <Download size={15} />
                    Project backup
                  </button>
                  <button onClick={() => startModal("trash")}>
                    <Trash2 size={15} />
                    Trash
                  </button>
                  <button onClick={() => startModal("help")}>
                    Keyboard & canvas guide
                  </button>
                </div>
              )}
            </div>
            <div className={`save-status ${w.status}`} role="status">
              {w.status === "saved" ? (
                <Check size={13} />
              ) : w.status === "saving" ? (
                <LoaderCircle className="spin" size={13} />
              ) : (
                <Circle size={13} />
              )}
              <span>
                {w.status === "saved"
                  ? "All changes saved"
                  : w.status === "saving"
                    ? "Saving…"
                    : "Save failed"}
              </span>
            </div>
            <div className="history-controls">
              <IconButton
                label="Undo (Ctrl+Z)"
                disabled={!w.canUndo}
                onClick={w.undo}
              >
                <Undo2 size={17} />
              </IconButton>
              <IconButton
                label="Redo (Ctrl+Shift+Z)"
                disabled={!w.canRedo}
                onClick={w.redo}
              >
                <Redo2 size={17} />
              </IconButton>
            </div>
            <button
              className="button subtle import-button"
              onClick={() => startModal("import")}
            >
              <Upload size={15} />
              Import
            </button>
            <button
              className="primary small"
              onClick={() => startModal("publish")}
            >
              <Download size={15} />
              Publish <ChevronDown size={13} />
            </button>
          </>
        ) : (
          <div className="topbar-right">
            <span className="offline-dot" />
            Your private writing space
          </div>
        )}
      </header>
      {p && w.error && (
        <div className="error-bar" role="alert">
          {w.error}
          <button onClick={() => void run(() => w.flush())}>Retry save</button>
          <button
            onClick={() =>
              void run(async () => deliver(await archiveBlob(w.ref.current!)))
            }
          >
            Download recovery
          </button>
        </div>
      )}
      {!p ? (
        <main className="dashboard">
          <div className="dashboard-title">
            <div>
              <div className="eyebrow">
                A LITTLE STRUCTURE. ENDLESS POSSIBILITY.
              </div>
              <h1>Make room for your next story.</h1>
              <p>Gather the fragments. Follow the threads. Find the shape.</p>
            </div>
            <button className="primary" onClick={() => startModal("new")}>
              <Plus size={18} />
              New project
            </button>
          </div>
          <div className="dashboard-tools">
            <h2>
              Your projects <span className="count">{projects.length}</span>
            </h2>
            <div className="search-box">
              <Search size={15} />
              <input
                aria-label="Search projects"
                placeholder="Find a story…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Sort projects"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Recently edited</option>
              <option value="name">Project name</option>
            </select>
            <button
              className="button"
              onClick={() => archiveInput.current?.click()}
            >
              <FolderOpen size={16} />
              Open backup
            </button>
          </div>
          <div className="project-grid">
            {projects
              .filter((x) =>
                x.name.toLowerCase().includes(projectSearch.toLowerCase()),
              )
              .sort((a, b) =>
                sort === "name"
                  ? a.name.localeCompare(b.name)
                  : b.updatedAt.localeCompare(a.updatedAt),
              )
              .map((project, index) => (
                <article className="project-card" key={project.id}>
                  <button
                    className={`project-cover cover-${index % 3}`}
                    onClick={() => void run(() => openProject(project))}
                  >
                    <Map size={55} strokeWidth={0.7} />
                    <span>
                      STORYTRACK / {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{project.name}</h3>
                  </button>
                  <div className="project-card-body">
                    <p>{project.description || "An unwritten possibility."}</p>
                    <div className="project-stats">
                      {orderedChapters(project).length} chapters <span>·</span>{" "}
                      {orderedNodes(project).length} nodes
                    </div>
                    <div className="project-card-footer">
                      <small>
                        {new Date(project.updatedAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </small>
                      <button
                        className="text-button"
                        onClick={() => void run(() => openProject(project))}
                      >
                        Continue <ArrowRight size={14} />
                      </button>
                      <IconButton
                        label={`Delete ${project.name}`}
                        onClick={() => {
                          if (
                            confirm(
                              `Permanently delete “${project.name}”? Download a backup first if you need to keep it.`,
                            )
                          )
                            void run(async () => {
                              await deleteProject(project.id);
                              await refresh();
                            });
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                </article>
              ))}
            <button
              className="new-project-card"
              onClick={() => startModal("new")}
            >
              <span>
                <Plus size={24} />
              </span>
              <h3>A new beginning</h3>
              <p>Every story starts with a single idea.</p>
            </button>
          </div>
          <div className="dashboard-note">
            <LockKeyhole size={15} />{" "}
            {edition === "browser"
              ? "Projects are saved in this browser. Keep a portable backup for safekeeping."
              : "Your work stays in your private local storage."}
          </div>
        </main>
      ) : (
        <>
          <div
            className="workspace"
            style={
              {
                "--left-width": `${view.leftWidth}px`,
                "--right-width": `${view.rightWidth}px`,
              } as CSSProperties
            }
          >
            {view.left && (
              <aside className="outline-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">YOUR STORY, AT A GLANCE</span>
                    <h2>Story outline</h2>
                  </div>
                  <IconButton
                    label="Collapse outline"
                    onClick={() => updateView({ left: false })}
                  >
                    <PanelLeftClose size={17} />
                  </IconButton>
                </div>
                <div className="outline-summary">
                  <BookOpen size={16} />
                  <span>
                    {p.sections.filter((s) => active(p, s)).length} parts
                  </span>
                  <span>·</span>
                  <span>{orderedChapters(p).length} chapters</span>
                  <span className="summary-nodes">
                    {orderedNodes(p).length} nodes
                  </span>
                </div>
                <div className="search-box outline-search">
                  <Search size={14} />
                  <input
                    aria-label="Search story"
                    placeholder="Find in your story…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <kbd>⌕</kbd>
                </div>
                <div className="outline-tree">
                  {p.sections
                    .filter((s) => !s.trashed)
                    .map((s, index) => (
                      <div
                        className={`section-group ${effective(p, s, "suspended") ? "is-suspended" : ""}`}
                        key={s.id}
                      >
                        <div className="section-row">
                          <button
                            className="section-label"
                            onClick={() => toggleCollapse(s.id)}
                          >
                            {view.collapsed.includes(s.id) ? (
                              <ChevronRight size={13} />
                            ) : (
                              <ChevronDown size={13} />
                            )}
                            <span className="part-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{s.title}</span>
                            {s.locked && <LockKeyhole size={12} />}
                          </button>
                          <IconButton
                            label={`Settings for part ${s.title}`}
                            onClick={() =>
                              setSectionSettings(
                                sectionSettings === s.id ? "" : s.id,
                              )
                            }
                          >
                            <Settings2 size={13} />
                          </IconButton>
                          <IconButton
                            label={`Add chapter to ${s.title}`}
                            onClick={() =>
                              change((d) => {
                                const section = d.sections.find(
                                  (x) => x.id === s.id,
                                )!;
                                assertEditable(d, section);
                                const c = newChapter(s.id);
                                d.chapters.push(c);
                                updateView({ chapter: c.id, selected: "" });
                                setTab("chapter");
                              })
                            }
                          >
                            <Plus size={14} />
                          </IconButton>
                        </div>
                        {sectionSettings === s.id && (
                          <div className="section-tools">
                            <input
                              aria-label={`Rename part ${index + 1}`}
                              value={s.title}
                              disabled={effective(p, s, "locked")}
                              onChange={(e) =>
                                change((d) => {
                                  const item = d.sections.find(
                                    (x) => x.id === s.id,
                                  )!;
                                  assertEditable(d, item);
                                  item.title = e.target.value;
                                })
                              }
                            />
                            {itemActions(s)}
                          </div>
                        )}
                        {!view.collapsed.includes(s.id) &&
                          p.chapters
                            .filter(
                              (c) =>
                                c.sectionId === s.id &&
                                !effective(p, c, "trashed"),
                            )
                            .map((c) => (
                              <div className="chapter-group" key={c.id}>
                                <div
                                  className={`chapter-row ${chapter?.id === c.id ? "current" : ""}`}
                                >
                                  <button
                                    onClick={() => {
                                      updateView({
                                        chapter: c.id,
                                        selected:
                                          p.nodes.find(
                                            (n) =>
                                              n.chapterId === c.id &&
                                              active(p, n),
                                          )?.id || "",
                                        all: false,
                                        scroll: 0,
                                      });
                                      setTab("chapter");
                                      if (canvas.current)
                                        canvas.current.scrollTop = 0;
                                    }}
                                  >
                                    <FileText size={15} />
                                    <span className="chapter-num">
                                      {chapterLabel(p, c).padStart(2, "0")}
                                    </span>
                                    <span>{c.title}</span>
                                    {effective(p, c, "locked") && (
                                      <LockKeyhole size={11} />
                                    )}
                                  </button>
                                  <IconButton
                                    label={`Toggle ${c.title}`}
                                    onClick={() => toggleCollapse(c.id)}
                                  >
                                    {view.collapsed.includes(c.id) ? (
                                      <ChevronRight size={12} />
                                    ) : (
                                      <ChevronDown size={12} />
                                    )}
                                  </IconButton>
                                </div>
                                {!view.collapsed.includes(c.id) &&
                                  p.nodes
                                    .filter(
                                      (n) =>
                                        n.chapterId === c.id &&
                                        !effective(p, n, "trashed") &&
                                        (!effective(p, n, "suspended") ||
                                          showSuspended) &&
                                        (!search ||
                                          nodeTitle(p, n)
                                            .toLowerCase()
                                            .includes(search.toLowerCase())),
                                    )
                                    .map((n) => (
                                      <div
                                        className={`outline-node ${view.selected === n.id ? "selected" : ""} ${effective(p, n, "suspended") ? "is-suspended" : ""}`}
                                        key={n.id}
                                        draggable={!effective(p, n, "locked")}
                                        onDragStart={(e) =>
                                          e.dataTransfer.setData(
                                            "text/storytracks-node",
                                            n.id,
                                          )
                                        }
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          const id = e.dataTransfer.getData(
                                            "text/storytracks-node",
                                          );
                                          if (id && id !== n.id)
                                            change((d) => {
                                              const moving = d.nodes.find(
                                                (x) => x.id === id,
                                              )!;
                                              if (
                                                moving.chapterId !== n.chapterId
                                              )
                                                moveItem(d, id, 0, n.chapterId);
                                              let limit = d.nodes.length;
                                              while (limit-- > 0) {
                                                const siblings = d.nodes.filter(
                                                    (x) =>
                                                      x.chapterId ===
                                                        n.chapterId &&
                                                      !x.trashed,
                                                  ),
                                                  a = siblings.findIndex(
                                                    (x) => x.id === id,
                                                  ),
                                                  b = siblings.findIndex(
                                                    (x) => x.id === n.id,
                                                  );
                                                if (a === b || a === b - 1)
                                                  break;
                                                moveItem(d, id, a > b ? -1 : 1);
                                              }
                                            });
                                        }}
                                      >
                                        <button onClick={() => selectNode(n)}>
                                          <span
                                            className={`node-dot ${n.kind}`}
                                          />
                                          <span>{nodeTitle(p, n)}</span>
                                          {n.templateId && <Link2 size={10} />}
                                        </button>
                                        <IconButton
                                          label={`Show ${nodeTitle(p, n)} on canvas`}
                                          onClick={() => selectNode(n, true)}
                                        >
                                          <Eye size={13} />
                                        </IconButton>
                                      </div>
                                    ))}
                              </div>
                            ))}
                      </div>
                    ))}
                </div>
                <div className="outline-bottom">
                  <button
                    className="text-button"
                    onClick={() => change((d) => d.sections.push(newSection()))}
                  >
                    <Plus size={15} />
                    Add a part
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Open trash"
                    onClick={() => startModal("trash")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <label className="check-label small-label">
                  <input
                    type="checkbox"
                    checked={showSuspended}
                    onChange={(e) => setShowSuspended(e.target.checked)}
                  />
                  Show suspended material
                </label>
                <div className="outline-foot">
                  <span className="offline-dot" />{" "}
                  {edition === "php" ? "Private workspace" : "Offline ready"}
                  <span>STORYTRACKS 01</span>
                </div>
              </aside>
            )}
            {view.left && (
              <div
                className="resize-handle"
                role="separator"
                aria-label="Resize outline"
                aria-orientation="vertical"
                tabIndex={0}
                onPointerDown={(e) => resize("left", e)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft")
                    updateView({
                      leftWidth: Math.max(
                        220,
                        Math.min(
                          440,
                          view.leftWidth + (e.key === "ArrowRight" ? 10 : -10),
                        ),
                      ),
                    });
                }}
              />
            )}
            <main className="canvas-panel">
              <div className="canvas-toolbar">
                <div className="canvas-location">
                  {!view.left && (
                    <IconButton
                      label="Open outline"
                      onClick={() => updateView({ left: true })}
                    >
                      <ChevronsRight size={17} />
                    </IconButton>
                  )}
                  <span className="eyebrow">THE WRITING DESK</span>
                  <span className="toolbar-divider" />
                  <button
                    className={view.all ? "" : "selected-filter"}
                    onClick={() => updateView({ all: false })}
                  >
                    Chapter
                  </button>
                  <button
                    className={view.all ? "selected-filter" : ""}
                    onClick={() => updateView({ all: true })}
                  >
                    Whole book
                  </button>
                </div>
                <div className="view-controls">
                  <IconButton
                    label="Canvas view"
                    active={!listView}
                    onClick={() => setListView(false)}
                  >
                    <LayoutGrid size={15} />
                  </IconButton>
                  <IconButton
                    label="Compact view"
                    active={listView}
                    onClick={() => setListView(true)}
                  >
                    <List size={16} />
                  </IconButton>
                  {!view.right && (
                    <IconButton
                      label="Open inspector"
                      onClick={() => updateView({ right: true })}
                    >
                      <ChevronsLeft size={17} />
                    </IconButton>
                  )}
                </div>
              </div>
              <div
                className="canvas-scroll"
                ref={canvas}
                onScroll={(e) => {
                  const scroll = e.currentTarget.scrollTop;
                  setView((v) => ({ ...v, scroll }));
                }}
                onPointerDown={(e) => {
                  if (
                    e.button === 1 ||
                    (space.current &&
                      !(e.target as HTMLElement).closest(
                        "input,textarea,button",
                      ))
                  ) {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    pan.current = {
                      x: e.clientX,
                      y: e.clientY,
                      sx: e.currentTarget.scrollLeft,
                      sy: e.currentTarget.scrollTop,
                    };
                  }
                }}
                onPointerMove={(e) => {
                  if (pan.current) {
                    e.currentTarget.scrollLeft =
                      pan.current.sx - (e.clientX - pan.current.x);
                    e.currentTarget.scrollTop =
                      pan.current.sy - (e.clientY - pan.current.y);
                  }
                }}
                onPointerUp={() => (pan.current = null)}
              >
                <div
                  className={`story-canvas ${listView ? "compact" : ""}`}
                  style={{ zoom: view.zoom / 100 } as CSSProperties}
                >
                  <div className="chapter-intro">
                    <div className="chapter-kicker">
                      <span />{" "}
                      {view.all
                        ? "THE COMPLETE STORY"
                        : `CHAPTER ${chapter ? chapterLabel(p, chapter).padStart(2, "0") : "01"}`}{" "}
                      <span />
                    </div>
                    <h1>
                      {view.all ? p.name : chapter?.title || "A new beginning"}
                    </h1>
                    <p>
                      {view.all
                        ? p.description
                        : chapter?.metadata.summary ||
                          "Every scene is a step. See where the story takes you."}
                    </p>
                    <div className="chapter-details">
                      <span>
                        <Layers size={12} />
                        {nodes.length} nodes
                      </span>
                      <span>·</span>
                      <span>{wordCount(p, nodes).toLocaleString()} words</span>
                      <span>·</span>
                      <span className="mood-dot" />
                      {chapter
                        ? effectiveMetadata(p, chapter).pacing || "Your pace"
                        : "Your story"}
                    </div>
                  </div>
                  <div className="track">
                    {nodes.map((n, index) => {
                      const KindIcon = icons[n.kind],
                        isSelected = view.selected === n.id,
                        blocks = resolvedBlocks(p, n),
                        isLocked = effective(p, n, "locked");
                      return (
                        <div
                          className={`track-step ${isSelected ? "is-selected" : ""}`}
                          key={n.id}
                          style={
                            {
                              contentVisibility:
                                editing === n.id ? "visible" : "auto",
                              containIntrinsicSize: listView
                                ? "auto 170px"
                                : "auto 280px",
                            } as CSSProperties
                          }
                        >
                          <div className="track-marker">
                            <span>{String(index + 1).padStart(2, "0")}</span>
                          </div>
                          {view.all &&
                            (index === 0 ||
                              nodes[index - 1].chapterId !== n.chapterId) && (
                              <div className="track-chapter-label">
                                Chapter{" "}
                                {chapterLabel(
                                  p,
                                  p.chapters.find((c) => c.id === n.chapterId)!,
                                )}{" "}
                                ·{" "}
                                {
                                  p.chapters.find((c) => c.id === n.chapterId)
                                    ?.title
                                }
                              </div>
                            )}
                          <article
                            id={"node-" + n.id}
                            className={`node-card ${isSelected ? "selected" : ""} ${effective(p, n, "suspended") ? "is-suspended" : ""}`}
                            onClick={() => selectNode(n)}
                          >
                            <header className="node-card-header">
                              <div className={`node-type ${n.kind}`}>
                                <KindIcon size={12} />
                                {n.kind === "turn"
                                  ? "TURNING POINT"
                                  : n.kind.toUpperCase()}
                                {n.templateId && <Link2 size={12} />}
                              </div>
                              <div className="node-card-actions">
                                {isLocked && <LockKeyhole size={12} />}
                                <span
                                  className="grip"
                                  draggable={!isLocked}
                                  aria-label="Drag node to reorder"
                                  title="Drag to reorder in the outline"
                                  onDragStart={(e) =>
                                    e.dataTransfer.setData(
                                      "text/storytracks-node",
                                      n.id,
                                    )
                                  }
                                >
                                  <GripVertical size={15} />
                                </span>
                                <IconButton
                                  label={`Settings for ${nodeTitle(p, n)}`}
                                  onClick={() => {
                                    selectNode(n);
                                    setTab("node");
                                    updateView({ right: true });
                                  }}
                                >
                                  <Settings2 size={14} />
                                </IconButton>
                              </div>
                            </header>
                            {editing === n.id && !isLocked && !n.templateId ? (
                              <div className="node-edit">
                                <input
                                  className="node-title-input"
                                  aria-label="Node title"
                                  placeholder="Give this moment a name…"
                                  value={n.title}
                                  onChange={(e) =>
                                    editNode(
                                      n.id,
                                      (x) => (x.title = e.target.value),
                                    )
                                  }
                                  autoFocus
                                />
                                {blocks.map((b, bi) => (
                                  <div className="block-editor" key={b.id}>
                                    {b.type === "text" ? (
                                      <textarea
                                        aria-label={`Content block ${bi + 1}`}
                                        placeholder="What happens in this moment?"
                                        value={b.text}
                                        onChange={(e) =>
                                          editNode(
                                            n.id,
                                            (x) =>
                                              (x.blocks.find(
                                                (y) => y.id === b.id,
                                              )!.text = e.target.value),
                                          )
                                        }
                                        onPaste={(e) => {
                                          const file = Array.from(
                                            e.clipboardData.files,
                                          ).find((f) =>
                                            f.type.startsWith("image/"),
                                          );
                                          if (file) {
                                            e.preventDefault();
                                            void run(() => addMedia(file));
                                          }
                                        }}
                                      />
                                    ) : (
                                      <>
                                        <MediaBlock p={p} b={b} />
                                        <input
                                          aria-label="Media caption"
                                          placeholder="Caption"
                                          value={b.caption}
                                          onChange={(e) =>
                                            editNode(
                                              n.id,
                                              (x) =>
                                                (x.blocks.find(
                                                  (y) => y.id === b.id,
                                                )!.caption = e.target.value),
                                            )
                                          }
                                        />
                                        {b.type === "image" && (
                                          <input
                                            aria-label="Alternative text"
                                            placeholder="Describe the image"
                                            value={b.alt}
                                            onChange={(e) =>
                                              editNode(
                                                n.id,
                                                (x) =>
                                                  (x.blocks.find(
                                                    (y) => y.id === b.id,
                                                  )!.alt = e.target.value),
                                              )
                                            }
                                          />
                                        )}
                                      </>
                                    )}
                                    <div className="block-tools">
                                      <IconButton
                                        label="Move block up"
                                        disabled={bi === 0}
                                        onClick={() =>
                                          editNode(n.id, (x) => {
                                            [x.blocks[bi - 1], x.blocks[bi]] = [
                                              x.blocks[bi],
                                              x.blocks[bi - 1],
                                            ];
                                          })
                                        }
                                      >
                                        <ArrowUp size={12} />
                                      </IconButton>
                                      <IconButton
                                        label="Move block down"
                                        disabled={bi === blocks.length - 1}
                                        onClick={() =>
                                          editNode(n.id, (x) => {
                                            [x.blocks[bi + 1], x.blocks[bi]] = [
                                              x.blocks[bi],
                                              x.blocks[bi + 1],
                                            ];
                                          })
                                        }
                                      >
                                        <ArrowDown size={12} />
                                      </IconButton>
                                      <IconButton
                                        label="Remove content block"
                                        onClick={() =>
                                          editNode(
                                            n.id,
                                            (x) =>
                                              (x.blocks = x.blocks.filter(
                                                (y) => y.id !== b.id,
                                              )),
                                          )
                                        }
                                      >
                                        <X size={12} />
                                      </IconButton>
                                    </div>
                                  </div>
                                ))}
                                <div className="edit-toolbar">
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      editNode(n.id, (x) =>
                                        x.blocks.push(textBlock()),
                                      )
                                    }
                                  >
                                    <Plus size={13} />
                                    Text
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => mediaInput.current?.click()}
                                  >
                                    <ImagePlus size={13} />
                                    Media
                                  </button>
                                  <button
                                    className="primary tiny"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditing("");
                                    }}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="node-body"
                                onDoubleClick={() => {
                                  if (!isLocked && !n.templateId)
                                    setEditing(n.id);
                                }}
                              >
                                <button
                                  className="node-title-button"
                                  onClick={() => {
                                    if (!isLocked && !n.templateId)
                                      setEditing(n.id);
                                  }}
                                >
                                  <h2>{nodeTitle(p, n)}</h2>
                                </button>
                                {blocks.length ? (
                                  blocks.map((b) =>
                                    b.type === "text" ? (
                                      <div className="prose" key={b.id}>
                                        {b.text ? (
                                          <ReactMarkdown
                                            skipHtml
                                            components={{
                                              img: () => null,
                                              a: ({ children }) => (
                                                <span>{children}</span>
                                              ),
                                            }}
                                          >
                                            {b.text}
                                          </ReactMarkdown>
                                        ) : (
                                          <p className="placeholder">
                                            Double-click to begin writing…
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <MediaBlock p={p} b={b} key={b.id} />
                                    ),
                                  )
                                ) : (
                                  <p className="placeholder">
                                    Add a thought, a scene, a possibility.
                                  </p>
                                )}
                              </div>
                            )}
                            <footer className="node-footer">
                              <div>
                                <span
                                  className="weight-dots"
                                  title={`Importance ${(n.importance / 2).toFixed(1)} of 5.5`}
                                >
                                  {[2, 4, 6, 8, 10].map((v) => (
                                    <i
                                      className={
                                        n.importance >= v ? "filled" : ""
                                      }
                                      key={v}
                                    />
                                  ))}
                                </span>
                                <span>
                                  Importance{" "}
                                  <b>{(n.importance / 2).toFixed(1)}</b>
                                </span>
                                <span className="footer-separator" />
                                <span>
                                  Liberty <b>{(n.liberty / 2).toFixed(1)}</b>
                                </span>
                              </div>
                              <span className="transition-label">
                                {sharpness(n.ending)} exit{" "}
                                <ArrowRight size={12} />
                              </span>
                            </footer>
                          </article>
                          <button
                            className="insert-node"
                            aria-label={`Insert node after ${nodeTitle(p, n)}`}
                            onClick={() => addNode(n.id)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      );
                    })}
                    {!nodes.length && (
                      <div className="empty-canvas">
                        <span className="empty-icon">
                          <FileText size={30} />
                        </span>
                        <h2>
                          {search
                            ? "No matching moments"
                            : "A blank page, a thousand possibilities."}
                        </h2>
                        <p>
                          {search
                            ? "Try a different word or clear your search."
                            : "Start with a scene, a feeling, or a single line."}
                        </p>
                        {search ? (
                          <button
                            className="button"
                            onClick={() => setSearch("")}
                          >
                            Clear search
                          </button>
                        ) : (
                          <button
                            className="primary"
                            disabled={!chapter}
                            onClick={() => addNode()}
                          >
                            <Plus size={16} />
                            Create your first node
                          </button>
                        )}
                      </div>
                    )}
                    {!!nodes.length && (
                      <button
                        className="add-node-bottom"
                        onClick={() => addNode()}
                      >
                        <Plus size={17} />
                        <span>Add the next moment</span>
                        <kbd>+</kbd>
                      </button>
                    )}
                  </div>
                  <div className="canvas-end">
                    <span /> A STORY TAKES SHAPE, ONE MOMENT AT A TIME <span />
                  </div>
                </div>
              </div>
              <div className="canvas-bottom">
                <span>
                  <span className="offline-dot" />
                  {view.all
                    ? "Whole book"
                    : `Chapter ${chapter ? chapterLabel(p, chapter) : "—"}`}
                  <span className="bottom-divider">/</span>
                  {selected ? "1 node selected" : "No selection"}
                </span>
                <div className="zoom-controls">
                  <IconButton
                    label="Zoom out"
                    onClick={() =>
                      updateView({ zoom: Math.max(25, view.zoom - 10) })
                    }
                  >
                    <ZoomOut size={15} />
                  </IconButton>
                  <button
                    onClick={() => updateView({ zoom: 100 })}
                    title="Reset zoom"
                  >
                    {view.zoom}%
                  </button>
                  <IconButton
                    label="Zoom in"
                    onClick={() =>
                      updateView({ zoom: Math.min(200, view.zoom + 10) })
                    }
                  >
                    <ZoomIn size={15} />
                  </IconButton>
                  <span className="toolbar-divider" />
                  <IconButton
                    label="Fit selected node"
                    onClick={() => {
                      if (selected) selectNode(selected, true);
                      else updateView({ zoom: 100 });
                    }}
                  >
                    <Maximize2 size={14} />
                  </IconButton>
                </div>
              </div>
            </main>
            {view.right && (
              <div
                className="resize-handle"
                role="separator"
                aria-label="Resize inspector"
                aria-orientation="vertical"
                tabIndex={0}
                onPointerDown={(e) => resize("right", e)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft")
                    updateView({
                      rightWidth: Math.max(
                        220,
                        Math.min(
                          440,
                          view.rightWidth + (e.key === "ArrowLeft" ? 10 : -10),
                        ),
                      ),
                    });
                }}
              />
            )}
            {view.right && (
              <aside className="inspector">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">GIVE YOUR STORY DIRECTION</span>
                    <h2>The details</h2>
                  </div>
                  <IconButton
                    label="Collapse inspector"
                    onClick={() => updateView({ right: false })}
                  >
                    <PanelRightClose size={17} />
                  </IconButton>
                </div>
                <div className="inspector-tabs" role="tablist">
                  {(["node", "chapter", "project"] as Tab[]).map((t) => (
                    <button
                      role="tab"
                      aria-selected={tab === t}
                      className={tab === t ? "active" : ""}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  <button
                    className={
                      ["notes", "resources", "templates"].includes(tab)
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setTab(
                        tab === "notes"
                          ? "resources"
                          : tab === "resources"
                            ? "templates"
                            : "notes",
                      )
                    }
                    title="Notes, resources and templates"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <div className="inspector-scroll">
                  {tab === "node" &&
                    (selected ? (
                      <>
                        <div className="inspector-node-label">
                          <span className={`node-dot ${selected.kind}`} />
                          {selected.kind === "turn"
                            ? "TURNING POINT"
                            : selected.kind.toUpperCase()}
                          <span>
                            #
                            {String(
                              orderedNodes(p, true).findIndex(
                                (n) => n.id === selected.id,
                              ) + 1,
                            ).padStart(2, "0")}
                          </span>
                        </div>
                        <h3 className="inspector-title">
                          {nodeTitle(p, selected)}
                        </h3>
                        <p className="inspector-description">
                          A little intention gives every moment a purpose.
                        </p>
                        {selected.templateId && (
                          <div className="linked-notice">
                            <Link2 size={15} />
                            Linked template
                            <button
                              onClick={() =>
                                change((d) =>
                                  detach(
                                    d,
                                    d.nodes.find((n) => n.id === selected.id)!,
                                  ),
                                )
                              }
                            >
                              Detach & edit
                            </button>
                          </div>
                        )}
                        <Field label="Node type">
                          <select
                            value={selected.kind}
                            disabled={locked}
                            onChange={(e) =>
                              editNode(
                                selected.id,
                                (n) =>
                                  (n.kind = e.target
                                    .value as StoryNode["kind"]),
                              )
                            }
                          >
                            <option value="beat">Story beat</option>
                            <option value="scene">Scene</option>
                            <option value="turn">Turning point</option>
                            <option value="note">Note</option>
                          </select>
                        </Field>
                        <div className="inspector-section-head">
                          <Settings2 size={14} />
                          <h4>NARRATIVE WEIGHT</h4>
                          <button
                            onClick={() =>
                              editNode(selected.id, (n) =>
                                Object.assign(n, defaults),
                              )
                            }
                            disabled={locked}
                          >
                            Reset
                          </button>
                        </div>
                        <Weight
                          label="Importance"
                          value={selected.importance / 2}
                          min={1}
                          max={5.5}
                          step={0.5}
                          hint="How much does this moment matter?"
                          low="Supporting"
                          high="Essential"
                          disabled={locked}
                          onChange={(v) =>
                            editNode(
                              selected.id,
                              (n) => (n.importance = Math.round(v * 2)),
                            )
                          }
                        />
                        <Weight
                          label="Creative liberty"
                          value={selected.liberty / 2}
                          min={1}
                          max={5.5}
                          step={0.5}
                          hint="How much room is there to reimagine it?"
                          low="Stay faithful"
                          high="Explore freely"
                          disabled={locked}
                          onChange={(v) =>
                            editNode(
                              selected.id,
                              (n) => (n.liberty = Math.round(v * 2)),
                            )
                          }
                        />
                        <div className="inspector-section-head">
                          <AudioLines size={14} />
                          <h4>TRANSITIONS</h4>
                        </div>
                        <Weight
                          label="Beginning"
                          value={selected.beginning}
                          min={0}
                          max={100}
                          step={1}
                          hint="The way we enter this moment."
                          low="Gradual"
                          high="Sharp"
                          disabled={locked}
                          onChange={(v) =>
                            editNode(selected.id, (n) => (n.beginning = v))
                          }
                        />
                        <Weight
                          label="Ending"
                          value={selected.ending}
                          min={0}
                          max={100}
                          step={1}
                          hint="The feeling we leave behind."
                          low="Gradual"
                          high="Sharp"
                          disabled={locked}
                          onChange={(v) =>
                            editNode(selected.id, (n) => (n.ending = v))
                          }
                        />
                        <div className="node-actions-grid">
                          <button
                            className="button"
                            disabled={locked || !!selected.templateId}
                            onClick={() => {
                              setEditing(selected.id);
                              selectNode(selected, true);
                            }}
                          >
                            <FileText size={14} />
                            Edit content
                          </button>
                          <button
                            className="button"
                            disabled={locked}
                            onClick={() => {
                              setFormName(nodeTitle(p, selected));
                              setTemplateEdit("");
                              setModal("template");
                            }}
                          >
                            <Copy size={14} />
                            Save template
                          </button>
                        </div>
                        <Field label="Move to chapter">
                          <select
                            value={selected.chapterId}
                            disabled={locked}
                            onChange={(e) =>
                              change((d) => {
                                moveItem(d, selected.id, 0, e.target.value);
                                updateView({ chapter: e.target.value });
                              })
                            }
                          >
                            {orderedChapters(p, true).map((c) => (
                              <option key={c.id} value={c.id}>
                                {chapterLabel(p, c)} · {c.title}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {itemActions(selected)}
                        <div className="small-note">
                          <LockKeyhole size={13} />
                          {locked
                            ? "Locked. Unlock the item or its parent to edit."
                            : "Weights are writing guidance, not inclusion rules."}
                        </div>
                      </>
                    ) : (
                      <div className="empty-panel">
                        <Settings2 size={25} />
                        <h3>Every moment has meaning.</h3>
                        <p>
                          Select a node to shape its weight and transitions.
                        </p>
                      </div>
                    ))}
                  {(tab === "project" || tab === "chapter") && (
                    <>
                      {tab === "chapter" && !chapter ? (
                        <p>Create a chapter in the outline.</p>
                      ) : (
                        <>
                          <div className="eyebrow">
                            {tab === "project"
                              ? "THE BIG PICTURE"
                              : `CHAPTER ${chapterLabel(p, chapter!)}`}
                          </div>
                          <h3 className="inspector-title">
                            {tab === "project"
                              ? "Your story’s compass"
                              : chapter!.title}
                          </h3>
                          <p className="inspector-description">
                            {tab === "project"
                              ? "Set the voice and feeling of your book."
                              : "Leave fields inherited, or give this chapter its own voice."}
                          </p>
                          <Field
                            label={
                              tab === "project"
                                ? "Project name"
                                : "Chapter title"
                            }
                          >
                            <input
                              value={
                                tab === "project" ? p.name : chapter!.title
                              }
                              disabled={
                                tab === "chapter" &&
                                effective(p, chapter!, "locked")
                              }
                              onChange={(e) =>
                                change((d) => {
                                  if (tab === "project") {
                                    if (e.target.value) d.name = e.target.value;
                                  } else {
                                    const c = d.chapters.find(
                                      (c) => c.id === chapter!.id,
                                    )!;
                                    assertEditable(d, c);
                                    c.title = e.target.value;
                                  }
                                })
                              }
                            />
                          </Field>
                          {tab === "project" ? (
                            <Field label="Logline / description">
                              <textarea
                                value={p.description}
                                onChange={(e) =>
                                  change(
                                    (d) => (d.description = e.target.value),
                                  )
                                }
                              />
                            </Field>
                          ) : (
                            <>
                              <Field
                                label="Chapter number"
                                hint="Leave blank for automatic numbering."
                              >
                                <input
                                  value={chapter!.manualLabel ?? ""}
                                  disabled={effective(p, chapter!, "locked")}
                                  placeholder={chapterLabel(p, chapter!)}
                                  onChange={(e) =>
                                    change((d) => {
                                      const c = d.chapters.find(
                                        (c) => c.id === chapter!.id,
                                      )!;
                                      assertEditable(d, c);
                                      c.manualLabel = e.target.value || null;
                                    })
                                  }
                                />
                              </Field>
                              {chapter!.manualLabel &&
                                p.chapters.some(
                                  (c) =>
                                    c.id !== chapter!.id &&
                                    c.manualLabel === chapter!.manualLabel,
                                ) && (
                                  <p className="warning">
                                    Another chapter uses this label.
                                  </p>
                                )}
                              <Field label="Chapter purpose">
                                <textarea
                                  value={chapter!.metadata.summary || ""}
                                  disabled={effective(p, chapter!, "locked")}
                                  onChange={(e) =>
                                    change((d) => {
                                      const c = d.chapters.find(
                                        (c) => c.id === chapter!.id,
                                      )!;
                                      assertEditable(d, c);
                                      c.metadata.summary = e.target.value;
                                    })
                                  }
                                />
                              </Field>
                            </>
                          )}
                          {metadataFields
                            .filter(
                              (k) =>
                                tab === "project" ||
                                ![
                                  "author",
                                  "genre",
                                  "audience",
                                  "language",
                                ].includes(k),
                            )
                            .map((k) => {
                              const meta =
                                  tab === "project"
                                    ? p.metadata
                                    : chapter!.metadata,
                                inherited = tab === "chapter" && !(k in meta);
                              return (
                                <div className="metadata-field" key={k}>
                                  <Field
                                    label={metadataLabels[k]}
                                    hint={
                                      inherited
                                        ? `Inherited: ${p.metadata[k] || "Not set"}`
                                        : undefined
                                    }
                                  >
                                    {k === "instructions" ? (
                                      <textarea
                                        value={meta[k] ?? ""}
                                        placeholder={
                                          inherited
                                            ? p.metadata[k] ||
                                              "Inherit from project"
                                            : "Add writing guidance…"
                                        }
                                        disabled={
                                          tab === "chapter" &&
                                          effective(p, chapter!, "locked")
                                        }
                                        onChange={(e) =>
                                          change((d) => {
                                            if (tab === "project")
                                              d.metadata[k] = e.target.value;
                                            else {
                                              const c = d.chapters.find(
                                                (c) => c.id === chapter!.id,
                                              )!;
                                              assertEditable(d, c);
                                              c.metadata[k] = e.target.value;
                                            }
                                          })
                                        }
                                      />
                                    ) : (
                                      <input
                                        value={meta[k] ?? ""}
                                        placeholder={
                                          inherited
                                            ? p.metadata[k] ||
                                              "Inherit from project"
                                            : "Not set"
                                        }
                                        disabled={
                                          tab === "chapter" &&
                                          effective(p, chapter!, "locked")
                                        }
                                        onChange={(e) =>
                                          change((d) => {
                                            if (tab === "project")
                                              d.metadata[k] = e.target.value;
                                            else {
                                              const c = d.chapters.find(
                                                (c) => c.id === chapter!.id,
                                              )!;
                                              assertEditable(d, c);
                                              c.metadata[k] = e.target.value;
                                            }
                                          })
                                        }
                                      />
                                    )}
                                  </Field>
                                  {tab === "chapter" && !inherited && (
                                    <button
                                      className="inherit-button"
                                      onClick={() =>
                                        change((d) => {
                                          const c = d.chapters.find(
                                            (c) => c.id === chapter!.id,
                                          )!;
                                          assertEditable(d, c);
                                          delete c.metadata[k];
                                        })
                                      }
                                    >
                                      Use project value
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          {tab === "chapter" && (
                            <>
                              {itemActions(chapter!)}
                              <Field label="Move chapter to part">
                                <select
                                  value={chapter!.sectionId}
                                  disabled={effective(p, chapter!, "locked")}
                                  onChange={(e) =>
                                    change((d) =>
                                      moveItem(
                                        d,
                                        chapter!.id,
                                        0,
                                        e.target.value,
                                      ),
                                    )
                                  }
                                >
                                  {p.sections
                                    .filter((s) => !s.trashed)
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.title}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {tab === "notes" && (
                    <>
                      <div className="eyebrow">ROOM FOR THE IN-BETWEEN</div>
                      <h3 className="inspector-title">Side notes</h3>
                      <p className="inspector-description">
                        Questions, connections, things to come back to.
                      </p>
                      <Field label="Attached to">
                        <select
                          value={noteScope}
                          onChange={(e) => setNoteScope(e.target.value)}
                        >
                          <option value="project">This project</option>
                          <option value="chapter" disabled={!chapter}>
                            This chapter
                          </option>
                          <option value="node" disabled={!selected}>
                            Selected node
                          </option>
                        </select>
                      </Field>
                      <textarea
                        className="notes-editor"
                        aria-label="Side note"
                        placeholder="Keep a thought close…"
                        value={note?.text || ""}
                        onChange={(e) =>
                          change((d) => {
                            if (!scopeId) return;
                            const owner = getItem(d, scopeId);
                            if (owner) assertEditable(d, owner);
                            const existing = d.notes.find(
                              (n) => n.ownerId === scopeId,
                            );
                            if (existing) existing.text = e.target.value;
                            else
                              d.notes.push({
                                id: uid(),
                                ownerId: scopeId,
                                text: e.target.value,
                                include: false,
                              });
                          })
                        }
                      />
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={note?.include || false}
                          onChange={(e) =>
                            change((d) => {
                              const n = d.notes.find(
                                (n) => n.ownerId === scopeId,
                              );
                              if (n) {
                                const owner = getItem(d, n.ownerId);
                                if (owner) assertEditable(d, owner);
                                n.include = e.target.checked;
                              }
                            })
                          }
                        />
                        Include in publication
                      </label>
                    </>
                  )}
                  {tab === "templates" && (
                    <>
                      <div className="eyebrow">THREADS WORTH REPEATING</div>
                      <h3 className="inspector-title">Node templates</h3>
                      <p className="inspector-description">
                        Recurring words and moments. Each placement has its own
                        weight.
                      </p>
                      {p.templates.map((t) => (
                        <div className="resource-card" key={t.id}>
                          <div>
                            <Copy size={16} />
                            <h4>{t.name}</h4>
                          </div>
                          <p>
                            {t.blocks
                              .filter((b) => b.type === "text")
                              .map((b) => b.text)
                              .join("\n")}
                          </p>
                          <small>
                            {
                              p.nodes.filter((n) => n.templateId === t.id)
                                .length
                            }{" "}
                            linked placements
                          </small>
                          <div className="resource-actions">
                            <button
                              className="text-button"
                              disabled={!chapter}
                              onClick={() => {
                                let id = "";
                                change((d) => {
                                  const c = d.chapters.find(
                                    (c) => c.id === chapter!.id,
                                  )!;
                                  assertEditable(d, c);
                                  const n = {
                                    ...newNode(c.id),
                                    blocks: [],
                                    templateId: t.id,
                                    importance: t.importance,
                                    liberty: t.liberty,
                                    beginning: t.beginning,
                                    ending: t.ending,
                                  };
                                  id = n.id;
                                  d.nodes.push(n);
                                });
                                if (id) updateView({ selected: id });
                              }}
                            >
                              <Plus size={13} />
                              Place
                            </button>
                            <button
                              className="text-button"
                              onClick={() => {
                                setTemplateEdit(t.id);
                                setFormName(t.name);
                                setFormText(
                                  t.blocks
                                    .filter((b) => b.type === "text")
                                    .map((b) => b.text)
                                    .join("\n\n"),
                                );
                                setModal("template");
                              }}
                            >
                              Edit
                            </button>
                            <IconButton
                              label={`Delete template ${t.name}`}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Delete this template and detach its placements, preserving their content?",
                                  )
                                )
                                  change((d) => {
                                    const linked = d.nodes.filter(
                                      (n) => n.templateId === t.id,
                                    );
                                    linked.forEach((n) => assertEditable(d, n));
                                    linked.forEach((n) => detach(d, n));
                                    d.templates = d.templates.filter(
                                      (x) => x.id !== t.id,
                                    );
                                  });
                              }}
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                      {!p.templates.length && (
                        <p className="small-note">
                          Select a node and choose Save template to start your
                          library.
                        </p>
                      )}
                    </>
                  )}
                  {tab === "resources" && (
                    <>
                      <div className="eyebrow">THE WORLD BEHIND THE WORDS</div>
                      <h3 className="inspector-title">Documents & resources</h3>
                      <p className="inspector-description">
                        Keep your research and historical context within reach.
                      </p>
                      <div className="resource-add">
                        <button
                          className="button"
                          onClick={() => {
                            setImportType("history");
                            startModal("import");
                          }}
                        >
                          <Plus size={14} />
                          Transcript
                        </button>
                        <button
                          className="button"
                          onClick={() => resourceInput.current?.click()}
                        >
                          <Upload size={14} />
                          File
                        </button>
                      </div>
                      {p.resources.map((r) => (
                        <div className="resource-card" key={r.id}>
                          <div>
                            <FileText size={17} />
                            <button
                              className="text-button"
                              onClick={() => {
                                setResourceId(r.id);
                                setFormName(r.title);
                                setFormText(r.text);
                                setModal("resource");
                              }}
                            >
                              <h4>{r.title}</h4>
                            </button>
                          </div>
                          <small>
                            {r.kind === "historical_transcript"
                              ? "Historical transcript"
                              : "Reference document"}
                          </small>
                          <p>{r.text.slice(0, 160)}</p>
                          {r.assetId && (
                            <button
                              className="text-button"
                              onClick={() =>
                                void run(async () => {
                                  const a = p.assets.find(
                                    (a) => a.id === r.assetId,
                                  )!;
                                  await deliver({
                                    filename: a.filename,
                                    blob: await (
                                      await fetch(
                                        `data:${a.mediaType};base64,${a.data}`,
                                      )
                                    ).blob(),
                                  });
                                })
                              }
                            >
                              <Download size={12} />
                              Download attachment
                            </button>
                          )}
                          <div className="resource-actions">
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={r.include}
                                onChange={(e) =>
                                  change(
                                    (d) =>
                                      (d.resources.find(
                                        (x) => x.id === r.id,
                                      )!.include = e.target.checked),
                                  )
                                }
                              />
                              Publish
                            </label>
                            <IconButton
                              label={`Remove ${r.title}`}
                              onClick={() => {
                                if (confirm(`Remove “${r.title}”?`))
                                  change(
                                    (d) =>
                                      (d.resources = d.resources.filter(
                                        (x) => x.id !== r.id,
                                      )),
                                  );
                              }}
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="inspector-bottom">
                  <button
                    className={tab === "notes" ? "active" : ""}
                    onClick={() => setTab("notes")}
                  >
                    <StickyNote size={15} />
                    Notes
                  </button>
                  <button
                    className={tab === "resources" ? "active" : ""}
                    onClick={() => setTab("resources")}
                  >
                    <FolderOpen size={15} />
                    Resources
                  </button>
                  <button
                    className={tab === "templates" ? "active" : ""}
                    onClick={() => setTab("templates")}
                  >
                    <Copy size={15} />
                    Templates
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      {modal === "new" && (
        <ModalShell
          title="A new story starts here."
          subtitle="Give your project a name. The rest can unfold."
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Field label="Project name">
              <input
                autoFocus
                required
                maxLength={200}
                placeholder="The title of your next chapter…"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </Field>
            <Field label="A line about your story (optional)">
              <textarea
                placeholder="What is waiting to be told?"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
            </Field>
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || !formName.trim()}>
                <Plus size={16} />
                Create project
              </button>
            </div>
          </form>
        </ModalShell>
      )}
      {modal === "rename" && p && (
        <ModalShell title="Rename your project" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              change((d) => (d.name = formName.trim()));
              setModal(null);
            }}
          >
            <Field label="Project name">
              <input
                autoFocus
                required
                maxLength={200}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </Field>
            <div className="modal-footer">
              <button className="primary" disabled={!formName.trim()}>
                Save name
              </button>
            </div>
          </form>
        </ModalShell>
      )}
      {modal === "import" && p && (
        <ModalShell
          title="Bring your ideas in."
          subtitle="Turn existing words into the beginnings of a story."
          wide
          onClose={() => setModal(null)}
        >
          <div className="segmented">
            <button
              className={importType === "outline" ? "active" : ""}
              onClick={() => setImportType("outline")}
            >
              Outline nodes
            </button>
            <button
              className={importType === "history" ? "active" : ""}
              onClick={() => setImportType("history")}
            >
              Historical transcript
            </button>
            <button onClick={() => archiveInput.current?.click()}>
              Project backup
            </button>
          </div>
          <div className="import-layout">
            <div>
              {importType === "history" && (
                <Field label="Transcript title">
                  <input
                    placeholder="Conversation with…"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </Field>
              )}
              <textarea
                className="import-text"
                aria-label="Text to import"
                placeholder={
                  "Paste your notes here.\n\nA blank line starts a new node.\nSingle line breaks stay together."
                }
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
              <input
                type="file"
                hidden
                ref={importInput}
                accept=".txt,.md"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      if (file.size > 5 * 1024 * 1024)
                        throw new Error("Text files must be 5 MB or smaller.");
                      const text = new TextDecoder("utf-8", {
                        fatal: true,
                      }).decode(await file.arrayBuffer());
                      setFormText(text);
                      if (!formName) setFormName(file.name);
                    });
                  e.target.value = "";
                }}
              />
              <button
                className="text-button"
                onClick={() => importInput.current?.click()}
              >
                <Upload size={14} />
                Choose a .txt or .md file
              </button>
              {importType === "outline" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={titleLine}
                    onChange={(e) => setTitleLine(e.target.checked)}
                  />
                  Use each first line as its node title
                </label>
              )}
            </div>
            <div className="import-preview">
              <div className="eyebrow">
                {importType === "outline"
                  ? `${splitText(formText).length} NODES TO CREATE`
                  : "HISTORICAL CONTEXT"}
              </div>
              {importType === "outline" ? (
                splitText(formText)
                  .slice(0, 12)
                  .map((s, i) => (
                    <div key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <p>{s}</p>
                    </div>
                  ))
              ) : (
                <p>
                  {formText ||
                    "Transcript text is preserved as context and included in the history companion by default."}
                </p>
              )}
            </div>
          </div>
          {importType === "outline" && (
            <p className="small-note">
              Inserted at the end of “{chapter?.title}”. Blank lines always
              split nodes, including inside Markdown lists or code blocks.
            </p>
          )}
          <div className="modal-footer">
            <button className="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                !formText.trim() || (importType === "outline" && !chapter)
              }
              onClick={() => {
                try {
                  w.change((d) => {
                    if (importType === "outline")
                      importText(d, chapter!.id, formText, titleLine);
                    else
                      d.resources.push({
                        id: uid(),
                        title: formName || "Historical transcript",
                        text: formText,
                        kind: "historical_transcript",
                        source: formName || "Pasted text",
                        createdAt: new Date().toISOString(),
                        include: true,
                      });
                  });
                  setModal(null);
                  if (importType === "history") setTab("resources");
                  notify(
                    importType === "outline"
                      ? "Your notes are now part of the story."
                      : "Historical transcript added.",
                  );
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Plus size={15} />
              {importType === "outline"
                ? `Import ${splitText(formText).length} nodes`
                : "Add transcript"}
            </button>
          </div>
        </ModalShell>
      )}
      {modal === "publish" && p && (
        <PublishModal
          p={p}
          includeSuspended={includeSuspended}
          setIncludeSuspended={setIncludeSuspended}
          busy={busy}
          close={() => setModal(null)}
          publish={() => {
            setBusy(true);
            void run(async () => {
              await w.flush();
              await publishProject(w.ref.current!, includeSuspended);
              setModal(null);
              notify("Your storytrack is ready.");
            }).finally(() => setBusy(false));
          }}
          backup={() => void run(backup)}
        />
      )}
      {modal === "trash" && p && (
        <ModalShell
          title="Nothing is lost just yet."
          subtitle="Restore material to its original place in your story."
          onClose={() => setModal(null)}
        >
          <div className="trash-list">
            {[...p.sections, ...p.chapters, ...p.nodes]
              .filter((i) => i.trashed)
              .map((i) => (
                <div key={i.id}>
                  <span>
                    {"chapterId" in i ? nodeTitle(p, i as StoryNode) : i.title}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      change((d) => {
                        const item = getItem(d, i.id)!;
                        if (ancestors(d, item).some((a) => a.trashed))
                          throw new Error("Restore the parent first.");
                        setState(d, i.id, "trashed", false);
                      })
                    }
                  >
                    Restore
                  </button>
                  <IconButton
                    label="Permanently delete"
                    onClick={() => {
                      if (
                        confirm(
                          "Permanently delete this item and its contents? This cannot be undone.",
                        )
                      )
                        change((d) => {
                          const target = getItem(d, i.id)!;
                          assertEditable(d, target, true);
                          const ids = new Set([
                            i.id,
                            ...[...d.chapters, ...d.nodes]
                              .filter((x) =>
                                ancestors(d, x).some((a) => a.id === i.id),
                              )
                              .map((x) => x.id),
                          ]);
                          d.sections = d.sections.filter((x) => !ids.has(x.id));
                          d.chapters = d.chapters.filter((x) => !ids.has(x.id));
                          d.nodes = d.nodes.filter((x) => !ids.has(x.id));
                          d.notes = d.notes.filter((x) => !ids.has(x.ownerId));
                        });
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            {![...p.sections, ...p.chapters, ...p.nodes].some(
              (i) => i.trashed,
            ) && <p className="empty-panel">Your trash is empty.</p>}
          </div>
        </ModalShell>
      )}
      {modal === "template" && p && (
        <ModalShell
          title={
            templateEdit
              ? "Edit linked template"
              : "Keep this thread for later."
          }
          subtitle={
            templateEdit
              ? `Changes affect ${p.nodes.filter((n) => n.templateId === templateEdit).length} linked placements. Their weights stay the same.`
              : "Reuse this content throughout your story, with independent weights."
          }
          onClose={() => setModal(null)}
        >
          <Field label="Template name">
            <input
              autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </Field>
          {templateEdit && (
            <Field label="Text content">
              <textarea
                className="template-text"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
              />
            </Field>
          )}
          {templateEdit && (
            <p className="small-note">
              Placements:{" "}
              {p.nodes
                .filter((n) => n.templateId === templateEdit)
                .map((n) => p.chapters.find((c) => c.id === n.chapterId)?.title)
                .join(", ") || "None yet"}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="primary"
              disabled={!formName.trim()}
              onClick={() => {
                try {
                  w.change((d) => {
                    if (templateEdit) {
                      d.nodes
                        .filter((n) => n.templateId === templateEdit)
                        .forEach((n) => assertEditable(d, n));
                      const t = d.templates.find((t) => t.id === templateEdit)!;
                      t.name = formName;
                      t.title = formName;
                      const media = t.blocks.filter((b) => b.type !== "text");
                      t.blocks = [textBlock(formText), ...media];
                    } else if (selected) {
                      d.templates.push({
                        id: uid(),
                        name: formName,
                        title: selected.title,
                        blocks: clone(resolvedBlocks(d, selected)).map((b) => ({
                          ...b,
                          id: uid(),
                        })),
                        importance: selected.importance,
                        liberty: selected.liberty,
                        beginning: selected.beginning,
                        ending: selected.ending,
                      });
                    }
                  });
                  setModal(null);
                  setTab("templates");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Save template
            </button>
          </div>
        </ModalShell>
      )}
      {modal === "resource" && p && (
        <ModalShell title="Reference material" onClose={() => setModal(null)}>
          <Field label="Title">
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </Field>
          <Field label="Content">
            <textarea
              className="template-text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
            />
          </Field>
          <div className="modal-footer">
            <button
              className="primary"
              onClick={() => {
                change((d) => {
                  const r = d.resources.find((r) => r.id === resourceId)!;
                  r.title = formName;
                  r.text = formText;
                });
                setModal(null);
              }}
            >
              Save resource
            </button>
          </div>
        </ModalShell>
      )}
      {modal === "help" && (
        <ModalShell
          title="Find your way around."
          onClose={() => setModal(null)}
        >
          <div className="help-grid">
            <kbd>Scroll</kbd>
            <p>Move through your story vertically.</p>
            <kbd>Ctrl + scroll</kbd>
            <p>Zoom the canvas.</p>
            <kbd>Space + drag</kbd>
            <p>Pan the canvas. Middle-button drag works too.</p>
            <kbd>Double-click</kbd>
            <p>Edit a node’s content. Or use Edit content in the inspector.</p>
            <kbd>Ctrl + Z</kbd>
            <p>Undo. Ctrl + Shift + Z to redo.</p>
            <kbd>Ctrl + S</kbd>
            <p>Save now. Changes also autosave.</p>
            <Eye size={16} />
            <p>Bring a node into view from the outline.</p>
          </div>
          <p className="small-note">
            Use the inspector’s arrows to reorder without dragging. Weights
            guide writing; suspension controls publication. Publish creates a
            local Markdown snapshot. Backups preserve the entire editable
            project.
          </p>
        </ModalShell>
      )}
    </div>
  );
}
function Weight({
  label,
  value,
  min,
  max,
  step,
  hint,
  low,
  high,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint: string;
  low: string;
  high: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="weight-control">
      <div>
        <label>{label}</label>
        <input
          aria-label={`${label} value`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (
              e.target.value &&
              Number.isFinite(v) &&
              v >= min &&
              v <= max &&
              Math.abs((v - min) / step - Math.round((v - min) / step)) < 0.001
            )
              onChange(v);
          }}
        />
      </div>
      <p>{hint}</p>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
      <div className="range-labels">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
function MediaBlock({ p, b }: { p: Project; b: Block }) {
  const a = p.assets.find((a) => a.id === b.assetId);
  if (!a)
    return (
      <p className="warning">Attachment missing. Restore it from a backup.</p>
    );
  const src = `data:${a.mediaType};base64,${a.data}`;
  return (
    <figure className="media-block">
      {b.type === "image" ? (
        <img loading="lazy" src={src} alt={b.alt || b.caption || a.filename} />
      ) : (
        <audio controls preload="none" src={src} />
      )}
      <figcaption>{b.caption}</figcaption>
    </figure>
  );
}
function PublishModal({
  p,
  includeSuspended,
  setIncludeSuspended,
  busy,
  close,
  publish,
  backup,
}: {
  p: Project;
  includeSuspended: boolean;
  setIncludeSuspended: (v: boolean) => void;
  busy: boolean;
  close: () => void;
  publish: () => void;
  backup: () => void;
}) {
  let out;
  try {
    out = publication(p, includeSuspended);
  } catch (e) {
    return (
      <ModalShell title="Publication needs attention" onClose={close}>
        <p role="alert">{(e as Error).message}</p>
      </ModalShell>
    );
  }
  return (
    <ModalShell
      title="Give your story a life beyond the canvas."
      subtitle="A portable Markdown storytrack, ready for your next step."
      onClose={close}
      wide
    >
      <div className="publish-summary">
        <div>
          <BookOpen size={22} />
          <b>{out.chapterCount}</b>
          <span>chapters</span>
        </div>
        <div>
          <Layers size={22} />
          <b>{out.nodeCount}</b>
          <span>nodes</span>
        </div>
        <div>
          <ImagePlus size={22} />
          <b>{out.assets.length}</b>
          <span>attachments</span>
        </div>
        <div>
          <FileText size={22} />
          <b>
            {
              p.resources.filter(
                (r) => r.kind === "historical_transcript" && r.include,
              ).length
            }
          </b>
          <span>transcripts</span>
        </div>
      </div>
      <div className="export-filename">
        <FileText size={19} />
        <div>
          <b>{out.name}-st.md</b>
          <p>
            {out.history || out.assets.length
              ? "Downloaded in a ZIP with companion material and relative asset links."
              : "A single Markdown document, readable anywhere."}
          </p>
        </div>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={includeSuspended}
          onChange={(e) => setIncludeSuspended(e.target.checked)}
        />
        Include suspended material (clearly labeled)
      </label>
      <details className="export-preview">
        <summary>Preview the storytrack</summary>
        <pre>{out.markdown}</pre>
      </details>
      <p className="small-note">
        Trash is always excluded. This publishes a snapshot of your outline, not
        generated prose. Nothing is uploaded.
      </p>
      <div className="modal-footer">
        <button className="text-button" onClick={backup}>
          Need an editable backup?
        </button>
        <button className="primary" disabled={busy} onClick={publish}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Download size={16} />
          )}
          Export storytrack
        </button>
      </div>
    </ModalShell>
  );
}
