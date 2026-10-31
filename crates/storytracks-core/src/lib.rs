use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write,
    path::PathBuf,
};
pub mod publish;

pub type Result<T> = std::result::Result<T, String>;
fn err<T: std::fmt::Display>(e: T) -> String {
    e.to_string()
}
fn require(ok: bool, msg: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(msg.into())
    }
}
fn list<'a>(p: &'a Value, key: &str) -> Result<&'a Vec<Value>> {
    p[key].as_array().ok_or_else(|| format!("Invalid {key}."))
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v[key].as_str().ok_or_else(|| format!("Invalid {key}."))
}
fn valid_id(v: &Value) -> bool {
    v.as_str().is_some_and(|s| uuid::Uuid::parse_str(s).is_ok())
}
pub fn split_text(text: &str) -> Vec<String> {
    regex::Regex::new(r"\n[\t ]*\n(?:[\t ]*\n)*")
        .unwrap()
        .split(
            &text
                .trim_start_matches('\u{feff}')
                .replace("\r\n", "\n")
                .replace('\r', "\n"),
        )
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}
fn items(p: &Value) -> Vec<&Value> {
    ["sections", "chapters", "nodes"]
        .iter()
        .flat_map(|key| p[key].as_array().into_iter().flatten())
        .collect()
}
fn parent(item: &Value) -> Option<&str> {
    item["chapterId"]
        .as_str()
        .or_else(|| item["sectionId"].as_str())
}
fn effective(map: &HashMap<&str, &Value>, item: &Value, state: &str) -> bool {
    item[state] == true
        || parent(item)
            .and_then(|id| map.get(id))
            .is_some_and(|p| effective(map, p, state))
}
pub fn validate(p: &Value) -> Result<()> {
    require(p["schemaVersion"] == 1, "Unsupported project schema.")?;
    require(valid_id(&p["id"]), "Invalid project ID.")?;
    require(p["revision"].as_u64().is_some(), "Invalid revision.")?;
    let name = text(p, "name")?;
    require(
        !name.is_empty() && name.chars().count() <= 200,
        "Invalid project name.",
    )?;
    for field in ["description", "createdAt", "updatedAt"] {
        text(p, field)?;
    }
    let metadata = p["metadata"].as_object().ok_or("Invalid metadata.")?;
    require(metadata.values().all(Value::is_string), "Invalid metadata.")?;
    let mut ids = HashSet::from([p["id"].as_str().unwrap()]);
    for field in [
        "sections",
        "chapters",
        "nodes",
        "templates",
        "notes",
        "resources",
        "assets",
    ] {
        for item in list(p, field)? {
            require(valid_id(&item["id"]), "Invalid item ID.")?;
            require(ids.insert(item["id"].as_str().unwrap()), "Duplicate ID.")?;
        }
    }
    let sections: HashSet<_> = list(p, "sections")?
        .iter()
        .map(|v| v["id"].as_str().unwrap())
        .collect();
    let chapters: HashSet<_> = list(p, "chapters")?
        .iter()
        .map(|v| v["id"].as_str().unwrap())
        .collect();
    let templates: HashSet<_> = list(p, "templates")?
        .iter()
        .map(|v| v["id"].as_str().unwrap())
        .collect();
    let assets: HashMap<_, _> = list(p, "assets")?
        .iter()
        .map(|v| (v["id"].as_str().unwrap(), v))
        .collect();
    let all: HashSet<_> = items(p).iter().map(|v| v["id"].as_str().unwrap()).collect();
    for i in items(p) {
        text(i, "title")?;
        for f in ["locked", "suspended", "trashed"] {
            require(i[f].is_boolean(), "Invalid state.")?;
        }
    }
    for c in list(p, "chapters")? {
        require(
            sections.contains(text(c, "sectionId")?),
            "Chapter has no section.",
        )?;
        require(
            c.get("manualLabel").is_some()
                && (c["manualLabel"].is_null() || c["manualLabel"].is_string()),
            "Invalid chapter label.",
        )?;
        require(
            c["metadata"]
                .as_object()
                .is_some_and(|m| m.values().all(Value::is_string)),
            "Invalid chapter metadata.",
        )?;
    }
    for n in list(p, "nodes")? {
        require(
            chapters.contains(text(n, "chapterId")?),
            "Node has no chapter.",
        )?;
        require(
            ["beat", "scene", "note", "turn"].contains(&text(n, "kind")?),
            "Invalid node kind.",
        )?;
        if let Some(t) = n.get("templateId") {
            require(
                templates.contains(t.as_str().unwrap_or("")) && n["blocks"] == json!([]),
                "Invalid template placement.",
            )?;
        }
    }
    for n in list(p, "nodes")?.iter().chain(list(p, "templates")?) {
        for f in ["importance", "liberty", "beginning", "ending"] {
            let (min, max) = if f == "importance" || f == "liberty" {
                (2, 11)
            } else {
                (0, 100)
            };
            require(
                n[f].as_i64().is_some_and(|v| v >= min && v <= max),
                "Invalid weight.",
            )?;
        }
        for b in list(n, "blocks")? {
            require(
                valid_id(&b["id"]) && ids.insert(b["id"].as_str().unwrap()),
                "Invalid or duplicate block ID.",
            )?;
            let kind = text(b, "type")?;
            require(
                ["text", "image", "audio"].contains(&kind),
                "Invalid block type.",
            )?;
            for f in ["text", "caption", "alt"] {
                text(b, f)?;
            }
            if kind != "text" {
                let a = assets.get(text(b, "assetId")?).ok_or("Missing media.")?;
                require(
                    text(a, "mediaType")?.starts_with(&format!("{kind}/")),
                    "Incompatible media.",
                )?;
            }
        }
    }
    for t in list(p, "templates")? {
        text(t, "name")?;
        text(t, "title")?;
    }
    let mut total_media_size = 0u64;
    for a in assets.values() {
        text(a, "filename")?;
        require(
            [
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "audio/mpeg",
                "audio/wav",
                "audio/ogg",
                "audio/mp4",
                "audio/webm",
                "application/pdf",
                "text/plain",
                "text/markdown",
            ]
            .contains(&text(a, "mediaType")?),
            "Unsupported media.",
        )?;
        let size = a["size"].as_u64().ok_or("Invalid attachment size.")?;
        require(size <= 25 * 1024 * 1024, "Attachment exceeds 25 MB.")?;
        total_media_size += size;
        require(
            total_media_size <= 100 * 1024 * 1024,
            "Project attachments exceed 100 MB.",
        )?;
        let bytes = STANDARD.decode(text(a, "data")?).map_err(err)?;
        require(
            bytes.len() as u64 == size
                && format!("{:x}", Sha256::digest(&bytes)) == text(a, "hash")?,
            "Corrupt attachment.",
        )?;
    }
    for n in list(p, "notes")? {
        if let Some(area) = n.get("canvasArea") {
            require(
                ["subcontext", "highlight"].contains(&area.as_str().unwrap_or("")),
                "Invalid canvas area.",
            )?;
            require(
                n["ownerId"] == p["id"]
                    || list(p, "nodes")?
                        .iter()
                        .any(|node| node["id"] == n["ownerId"]),
                "Canvas notes must connect to a node.",
            )?;
        }
        if n.get("title").is_some() {
            text(n, "title")?;
        }
        let owner = text(n, "ownerId")?;
        require(
            owner == p["id"].as_str().unwrap() || all.contains(owner),
            "Invalid note owner.",
        )?;
        text(n, "text")?;
        require(n["include"].is_boolean(), "Invalid inclusion.")?;
    }
    for r in list(p, "resources")? {
        require(
            ["historical_transcript", "reference"].contains(&text(r, "kind")?),
            "Invalid resource type.",
        )?;
        for f in ["title", "text", "source", "createdAt"] {
            text(r, f)?;
        }
        require(r["include"].is_boolean(), "Invalid inclusion.")?;
        if let Some(a) = r.get("assetId") {
            require(
                assets.contains_key(a.as_str().unwrap_or("")),
                "Missing resource attachment.",
            )?;
        }
    }
    if let Some(w) = p.get("workbook") {
        text(w, "templateId")?;
        for (key, fields) in [
            ("prompts", vec!["category", "question", "answer"]),
            ("world", vec!["category", "title", "description"]),
            (
                "questions",
                vec![
                    "statement",
                    "source",
                    "question",
                    "insight",
                    "alternatives",
                    "audience",
                    "hook",
                ],
            ),
        ] {
            for entry in list(w, key)? {
                require(valid_id(&entry["id"]), "Invalid workbook ID.")?;
                require(ids.insert(entry["id"].as_str().unwrap()), "Duplicate ID.")?;
                require(entry["include"].is_boolean(), "Invalid workbook inclusion.")?;
                for field in &fields {
                    text(entry, field)?;
                }
                if key == "questions" {
                    let candidates = list(entry, "candidates")?;
                    require(
                        candidates.len() <= 12 && candidates.iter().all(Value::is_string),
                        "Invalid question candidates.",
                    )?;
                }
            }
        }
    }
    Ok(())
}
pub fn validate_transition(old: &Value, new: &Value) -> Result<()> {
    let before: HashMap<_, _> = items(old)
        .into_iter()
        .map(|i| (i["id"].as_str().unwrap(), i))
        .collect();
    let after: HashMap<_, _> = items(new)
        .into_iter()
        .map(|i| (i["id"].as_str().unwrap(), i))
        .collect();
    for (id, item) in &after {
        let changed_parent = before
            .get(id)
            .is_none_or(|previous| parent(previous) != parent(item));
        if changed_parent {
            let mut cursor = parent(item);
            while let Some(pid) = cursor {
                if let Some(old_parent) = before.get(pid) {
                    require(
                        !effective(&before, old_parent, "locked"),
                        "Cannot add or move content into a locked group.",
                    )?;
                }
                cursor = after.get(pid).and_then(|p| parent(p));
            }
        }
    }
    for (id, item) in &before {
        if !effective(&before, item, "locked") {
            continue;
        }
        let next = after.get(id).ok_or("A locked item cannot be deleted.")?;
        let mut comparable = (*next).clone();
        let inherited = parent(item)
            .and_then(|id| before.get(id))
            .is_some_and(|p| effective(&before, p, "locked"));
        if !inherited && item["locked"] == true && next["locked"] == false {
            comparable["locked"] = json!(true);
        }
        require(**item == comparable, "A locked item cannot be changed.")?;
        if let Some(t) = item.get("templateId") {
            let a = list(old, "templates")?.iter().find(|x| x["id"] == *t);
            let b = list(new, "templates")?.iter().find(|x| x["id"] == *t);
            require(
                a.zip(b)
                    .is_some_and(|(a, b)| a["title"] == b["title"] && a["blocks"] == b["blocks"]),
                "A locked template placement blocks this update.",
            )?;
        }
        let mut cursor = parent(item);
        while let Some(cid) = cursor {
            let a = before[cid];
            let b = after
                .get(cid)
                .ok_or("A locked descendant prevents deletion.")?;
            for f in ["chapterId", "sectionId", "suspended", "trashed"] {
                require(a[f] == b[f], "A locked descendant prevents this change.")?;
            }
            validate_position(old, new, a)?;
            cursor = parent(a);
        }
        let a: Vec<_> = list(old, "notes")?
            .iter()
            .filter(|n| n["ownerId"].as_str() == Some(*id))
            .collect();
        let b: Vec<_> = list(new, "notes")?
            .iter()
            .filter(|n| n["ownerId"].as_str() == Some(*id))
            .collect();
        require(a == b, "A locked note cannot be changed.")?;
        if item.get("blocks").is_some() {
            let content = if let Some(t) = item.get("templateId") {
                list(old, "templates")?
                    .iter()
                    .find(|x| x["id"] == *t)
                    .unwrap()
            } else {
                item
            };
            for block in list(content, "blocks")? {
                if let Some(asset) = block.get("assetId") {
                    let a = list(old, "assets")?.iter().find(|a| a["id"] == *asset);
                    let b = list(new, "assets")?.iter().find(|a| a["id"] == *asset);
                    require(a == b, "A locked item protects its media.")?;
                }
            }
        }
        validate_position(old, new, item)?;
    }
    Ok(())
}
fn validate_position(old: &Value, new: &Value, item: &Value) -> Result<()> {
    let id = text(item, "id")?;
    let key = if item.get("chapterId").is_some() {
        "nodes"
    } else if item.get("sectionId").is_some() {
        "chapters"
    } else {
        "sections"
    };
    let a: Vec<_> = list(old, key)?
        .iter()
        .filter(|n| parent(n) == parent(item))
        .collect();
    let b: Vec<_> = list(new, key)?
        .iter()
        .filter(|n| parent(n) == parent(item))
        .collect();
    let pos_a = a.iter().position(|n| n["id"].as_str() == Some(id)).unwrap();
    let pos_b = b
        .iter()
        .position(|n| n["id"].as_str() == Some(id))
        .ok_or("Locked item moved.")?;
    for (j, other) in a.iter().enumerate() {
        if let Some(k) = b.iter().position(|n| n["id"] == other["id"]) {
            require((j < pos_a) == (k < pos_b), "Cannot cross a locked sibling.")?;
        }
    }
    Ok(())
}
pub struct Store {
    db: Connection,
    dir: PathBuf,
}
impl Store {
    pub fn open(dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(dir.join("assets")).map_err(err)?;
        let db = Connection::open(dir.join("storytracks.sqlite")).map_err(err)?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
            .map_err(err)?;
        let version: u32 = db
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(err)?;
        require(
            version <= 1,
            "This database requires a newer StoryTracks version.",
        )?;
        db.execute_batch("CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,document TEXT NOT NULL); PRAGMA user_version=1;").map_err(err)?;
        Ok(Self { db, dir })
    }
    fn hydrate(&self, document: &str) -> Result<Value> {
        hydrate(&self.dir, document)
    }
    pub fn list(&self) -> Result<Vec<Value>> {
        let mut q = self
            .db
            .prepare("SELECT document FROM projects ORDER BY rowid DESC")
            .map_err(err)?;
        let rows = q
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(err)?;
        rows.map(|row| self.hydrate(&row.map_err(err)?)).collect()
    }
    pub fn save(&mut self, mut project: Value, expected: u64) -> Result<Value> {
        validate(&project)?;
        let tx = self
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(err)?;
        let old: Option<(u64, String)> = tx
            .query_row(
                "SELECT revision,document FROM projects WHERE id=?",
                [text(&project, "id")?],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(err)?;
        require(
            old.as_ref().map_or(0, |v| v.0) == expected,
            "This project changed in another window. Download a recovery backup, then reopen it.",
        )?;
        if let Some((_, document)) = old {
            validate_transition(&hydrate(&self.dir, &document)?, &project)?;
        }
        project["revision"] = json!(expected + 1);
        project["updatedAt"] =
            json!(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
        let mut stored = project.clone();
        for a in stored["assets"].as_array_mut().unwrap() {
            let path = self.dir.join("assets").join(text(a, "hash")?);
            if !path.exists() {
                let mut temp =
                    tempfile::NamedTempFile::new_in(self.dir.join("assets")).map_err(err)?;
                temp.write_all(&STANDARD.decode(text(a, "data")?).map_err(err)?)
                    .map_err(err)?;
                temp.as_file().sync_all().map_err(err)?;
                temp.persist(&path).map_err(err)?;
            }
            a["data"] = json!("");
        }
        tx.execute("INSERT INTO projects(id,revision,document) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document",params![text(&project,"id")?,expected+1,stored.to_string()]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(project)
    }
    pub fn snapshot(&self, id: &str, revision: u64) -> Result<Value> {
        let row: Option<(u64, String)> = self
            .db
            .query_row(
                "SELECT revision,document FROM projects WHERE id=?",
                [id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(err)?;
        let (saved_revision, document) = row.ok_or("Project not found.")?;
        require(
            saved_revision == revision,
            "Project changed before publication. Reopen it and try again.",
        )?;
        self.hydrate(&document)
    }
    pub fn delete(&self, id: &str) -> Result<()> {
        require(uuid::Uuid::parse_str(id).is_ok(), "Invalid project ID.")?;
        self.db
            .execute("DELETE FROM projects WHERE id=?", [id])
            .map_err(err)?;
        Ok(())
    }
}
fn hydrate(dir: &std::path::Path, document: &str) -> Result<Value> {
    let mut p: Value = serde_json::from_str(document).map_err(err)?;
    for a in p["assets"].as_array_mut().ok_or("Invalid stored assets.")? {
        let bytes = match fs::read(dir.join("assets").join(text(a, "hash")?)) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(_) => return Err("Unable to read an attachment. Check storage permissions.".into()),
        };
        a["data"] = json!(STANDARD.encode(bytes));
    }
    Ok(p)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn durable_storage_and_revision_safe_snapshot() {
        let fixture: Value =
            serde_json::from_str(include_str!("../../../contracts/fixtures.json")).unwrap();
        let p = fixture["project"].clone();
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(dir.path().into()).unwrap();
        let saved = store.save(p.clone(), 0).unwrap();
        assert_eq!(saved["revision"], 1);
        assert!(store.save(p.clone(), 0).is_err());
        assert!(store.snapshot(p["id"].as_str().unwrap(), 0).is_err());
        assert_eq!(store.snapshot(p["id"].as_str().unwrap(), 1).unwrap(), saved);
        drop(store);
        assert_eq!(
            Store::open(dir.path().into()).unwrap().list().unwrap()[0],
            saved
        );
    }
    #[test]
    fn splitting() {
        assert_eq!(
            split_text("\u{feff}First\r\nsecond\r\n \t\r\nThird\r\n\r\n"),
            vec!["First\nsecond", "Third"]
        );
    }
    #[test]
    fn shared_fixtures() {
        let text = include_str!("../../../contracts/fixtures.json");
        let fixtures: Value = serde_json::from_str(text).unwrap();
        for case in fixtures["splits"].as_array().unwrap() {
            assert_eq!(
                json!(split_text(case["input"].as_str().unwrap())),
                case["output"]
            );
        }
        let project = fixtures["project"].clone();
        validate(&project).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(dir.path().to_path_buf()).unwrap();
        let saved = store.save(project.clone(), 0).unwrap();
        assert_eq!(saved["revision"], 1);
        assert!(store.save(project.clone(), 0).is_err());
        assert_eq!(store.list().unwrap().len(), 1);
        let mut invalid = project.clone();
        invalid["nodes"][0]["importance"] = json!(12);
        assert!(validate(&invalid).is_err());
        let mut locked = project.clone();
        locked["nodes"][0]["locked"] = json!(true);
        let mut changed = locked.clone();
        changed["nodes"][0]["title"] = json!("Changed");
        assert!(validate_transition(&locked, &changed).is_err());
    }
    #[test]
    fn locked_groups_protect_membership_and_ancestor_order() {
        let f: Value =
            serde_json::from_str(include_str!("../../../contracts/fixtures.json")).unwrap();
        let mut p = f["project"].clone();
        p["chapters"][0]["locked"] = json!(true);
        let mut changed = p.clone();
        let mut added = changed["nodes"][0].clone();
        added["id"] = json!("d73ae8bc-d344-4e3b-9881-8b84850674b1");
        changed["nodes"].as_array_mut().unwrap().push(added);
        assert!(validate_transition(&p, &changed).is_err());
        let mut p = f["project"].clone();
        p["nodes"][0]["locked"] = json!(true);
        let mut changed = p.clone();
        changed["sections"].as_array_mut().unwrap().swap(0, 1);
        assert!(validate_transition(&p, &changed).is_err());
    }
    #[test]
    fn template_defaults_do_not_change_locked_placements() {
        let f: Value =
            serde_json::from_str(include_str!("../../../contracts/fixtures.json")).unwrap();
        let mut p = f["project"].clone();
        let n = p["nodes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|n| n.get("templateId").is_some())
            .unwrap();
        n["locked"] = json!(true);
        let mut changed = p.clone();
        changed["templates"][0]["importance"] = json!(11);
        validate_transition(&p, &changed).unwrap();
        changed["templates"][0]["blocks"][0]["text"] = json!("Blocked");
        assert!(validate_transition(&p, &changed).is_err());
    }
}
