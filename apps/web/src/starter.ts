import { demoProject, type Project } from "./domain";
import { hashBytes } from "./export";

const legacyTitle = "The Cartographer’s Daughter";
// The original starter, with generated IDs and timestamps removed from the comparison.
const legacyFingerprint =
  "006177bb7950855af711fc3e4cadde3b2a34f0997967ba1aa23b0ff1fe3e2fe2";
const idFields = new Set([
  "id",
  "chapterId",
  "sectionId",
  "ownerId",
  "templateId",
  "assetId",
]);

function fingerprint(project: Project) {
  const identities = new Map<string, number>();
  const canonical = JSON.stringify(project, (key, value) => {
    if (key === "revision" || key === "createdAt" || key === "updatedAt")
      return undefined;
    if (idFields.has(key) && typeof value === "string") {
      if (!identities.has(value)) identities.set(value, identities.size);
      return identities.get(value);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((field) => [field, value[field]]),
      );
    }
    return value;
  });
  return hashBytes(new TextEncoder().encode(canonical));
}

export async function replacementStarter(
  project: Project,
): Promise<Project | undefined> {
  if (project.name !== legacyTitle || project.revision !== 1) return;
  if ((await fingerprint(project)) !== legacyFingerprint) return;

  const replacement = demoProject();
  for (const note of replacement.notes) {
    if (note.ownerId === replacement.id) note.ownerId = project.id;
  }
  return {
    ...replacement,
    id: project.id,
    createdAt: project.createdAt,
    revision: project.revision,
  };
}
