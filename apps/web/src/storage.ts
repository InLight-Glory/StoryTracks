import { Project, validateProject } from "./domain";
import { publishBlob } from "./export";
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    STORYTRACKS_PHP?: boolean;
  }
}
export const edition = window.__TAURI_INTERNALS__
  ? "desktop"
  : window.STORYTRACKS_PHP
    ? "php"
    : "browser";
let dbPromise: Promise<IDBDatabase>;
function db() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const r = indexedDB.open("storytracks-v1", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
let csrf = "";
async function api(action: string, body?: unknown) {
  const r = await fetch(`api.php?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Server request failed.");
  if (data.csrf) csrf = data.csrf;
  return data;
}
export async function login(password: string) {
  await api("login", { password });
}
export async function session() {
  return edition === "php" ? api("session") : { authenticated: true };
}
async function invoke<T>(command: string, args?: Record<string, unknown>) {
  return (await import("@tauri-apps/api/core")).invoke<T>(command, args);
}
export async function listProjects(): Promise<Project[]> {
  if (edition === "desktop") return invoke("list_projects");
  if (edition === "php") return (await api("list")).projects;
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction("projects").objectStore("projects").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveProject(
  p: Project,
  expectedRevision: number,
): Promise<Project> {
  const clean = validateProject(p);
  if (edition === "desktop")
    return invoke("save_project", { project: clean, expectedRevision });
  if (edition === "php")
    return (await api("save", { project: clean, expectedRevision })).project;
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("projects", "readwrite"),
      store = tx.objectStore("projects"),
      req = store.get(p.id);
    let saved: Project;
    req.onsuccess = () => {
      if ((req.result?.revision || 0) !== expectedRevision) {
        tx.abort();
        reject(
          new Error(
            "This project changed in another window. Download a recovery backup, then reopen the project.",
          ),
        );
        return;
      }
      saved = {
        ...clean,
        revision: expectedRevision + 1,
        updatedAt: new Date().toISOString(),
      };
      store.put(saved);
    };
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error || new Error("Unable to save."));
    tx.onabort = () => reject(tx.error || new Error("Save cancelled."));
  });
}
export async function deleteProject(id: string) {
  if (edition === "desktop") return invoke("delete_project", { id });
  if (edition === "php") return api("delete", { id });
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function deliver(result: { filename: string; blob: Blob }) {
  if (edition === "desktop") {
    const saved=await invoke<boolean>("write_export", {
      filename: result.filename,
      bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
    });
    if(!saved) throw new Error("Export cancelled.");
    return;
  }
  const url = URL.createObjectURL(result.blob),
    a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function publishProject(project:Project,includeSuspended:boolean){
  if(edition==='desktop'){
    const saved=await invoke<boolean>('publish_project',{project,includeSuspended});
    if(!saved)throw new Error('Export cancelled.');
  }else if(edition==='php') {
    const out=await api('publish',{id:project.id,revision:project.revision,includeSuspended});
    await deliver(await publishBlob(project,includeSuspended,out.publication));
  }else await deliver(await publishBlob(project,includeSuspended));
}
