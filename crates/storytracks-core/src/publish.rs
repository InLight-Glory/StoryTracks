use super::*;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
const URL_ENCODE: &percent_encoding::AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~')
    .remove(b'!')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')')
    .remove(b'*');
pub struct Publication {
    pub name: String,
    pub markdown: String,
    pub history: Option<String>,
    pub assets: Vec<(String, Vec<u8>)>,
}
fn heading(text: &str) -> String {
    let text = regex::Regex::new(r"[\r\n]+")
        .unwrap()
        .replace_all(text, " ");
    let mut out = String::new();
    for c in text.chars() {
        if "\\`*_{}[]<>#".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
pub fn safe_name(text: &str) -> String {
    let name: String = text
        .chars()
        .map(|c| {
            if "<>:\"/\\|?*".contains(c) || c.is_control() {
                '-'
            } else {
                c
            }
        })
        .collect();
    let mut name: String = name
        .trim_end_matches(['.', ' '])
        .trim()
        .chars()
        .take(100)
        .collect();
    if name.is_empty() {
        name = "Untitled".into();
    }
    if regex::Regex::new(r"(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)")
        .unwrap()
        .is_match(&name)
    {
        name = format!("_{name}");
    }
    name
}
fn label(k: &str) -> &str {
    match k {
        "author" => "Author",
        "genre" => "Genre",
        "audience" => "Intended audience",
        "language" => "Language",
        "style" => "Writing style",
        "tone" => "Tone",
        "mood" => "Mood",
        "pov" => "Point of view",
        "tense" => "Tense",
        "pacing" => "Pacing",
        "targetLength" => "Target length",
        "instructions" => "Writing instructions",
        other => other,
    }
}
fn sharpness(v: i64) -> &'static str {
    if v <= 33 {
        "gradual"
    } else if v <= 66 {
        "moderate"
    } else {
        "sharp"
    }
}
fn path(a: &Value) -> String {
    let ext = match a["mediaType"].as_str().unwrap() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "audio/mpeg" => "mp3",
        "audio/wav" => "wav",
        "audio/ogg" => "ogg",
        "audio/mp4" => "m4a",
        "application/pdf" => "pdf",
        "text/plain" => "txt",
        "text/markdown" => "md",
        _ => "bin",
    };
    format!("assets/{}.{ext}", a["id"].as_str().unwrap())
}
fn media(
    p: &Value,
    id: &str,
    label: &str,
    image: bool,
    used: &mut HashSet<String>,
) -> Result<String> {
    let a = list(p, "assets")?
        .iter()
        .find(|a| a["id"] == id)
        .ok_or("Missing attachment.")?;
    used.insert(id.into());
    Ok(format!(
        "{}[{}]({})",
        if image { "!" } else { "" },
        heading(if label.is_empty() {
            text(a, "filename")?
        } else {
            label
        }),
        path(a)
    ))
}
fn blocks<'a>(p: &'a Value, n: &'a Value) -> &'a Vec<Value> {
    if let Some(t) = n.get("templateId") {
        p["templates"]
            .as_array()
            .unwrap()
            .iter()
            .find(|x| x["id"] == *t)
            .unwrap()["blocks"]
            .as_array()
            .unwrap()
    } else {
        n["blocks"].as_array().unwrap()
    }
}
fn title(p: &Value, n: &Value) -> String {
    let title = if let Some(t) = n.get("templateId") {
        p["templates"]
            .as_array()
            .unwrap()
            .iter()
            .find(|x| x["id"] == *t)
            .unwrap()["title"]
            .as_str()
            .unwrap()
    } else {
        n["title"].as_str().unwrap()
    };
    if !title.is_empty() {
        return title.into();
    }
    let line = blocks(p, n)
        .iter()
        .find(|b| b["type"] == "text")
        .map(|b| b["text"].as_str().unwrap().split('\n').next().unwrap_or(""))
        .unwrap_or("");
    if line.is_empty() {
        "Untitled node".into()
    } else {
        line.chars().take(60).collect()
    }
}
pub fn publication(p: &Value, suspended: bool) -> Result<Publication> {
    validate(p)?;
    let name = safe_name(text(p, "name")?);
    let mut used = HashSet::new();
    let map: HashMap<_, _> = items(p)
        .into_iter()
        .map(|i| (i["id"].as_str().unwrap(), i))
        .collect();
    let active = |i: &Value, include: bool| {
        !effective(&map, i, "trashed") && (include || !effective(&map, i, "suspended"))
    };
    let chapters: Vec<_> = list(p, "sections")?
        .iter()
        .filter(|s| active(s, suspended))
        .flat_map(|s| {
            p["chapters"]
                .as_array()
                .unwrap()
                .iter()
                .filter(move |c| c["sectionId"] == s["id"] && active(c, suspended))
        })
        .collect();
    let automatic: Vec<_> = list(p, "sections")?
        .iter()
        .filter(|s| active(s, false))
        .flat_map(|s| {
            p["chapters"].as_array().unwrap().iter().filter(move |c| {
                c["sectionId"] == s["id"] && active(c, false) && c["manualLabel"].is_null()
            })
        })
        .collect();
    let mut lines = vec![
        "---".into(),
        "storytrack_format: 1".into(),
        format!("project_id: {}", p["id"]),
        format!("project_name: {}", p["name"]),
        format!("project_revision: {}", p["revision"]),
        "---".into(),
        "".into(),
        format!("# {} — StoryTrack", heading(text(p, "name")?)),
        "".into(),
        text(p, "description")?.into(),
        "".into(),
        "## Project writing guidance".into(),
        "".into(),
    ];
    for (k, v) in p["metadata"].as_object().unwrap() {
        lines.push(format!("{}: {}", label(k), v.as_str().unwrap()));
    }
    lines.extend(
        [
            "",
            "## Weight guide",
            "",
            "Importance: 1–5.5; higher means more important.",
            "Liberty: 1–5.5; higher allows more deviation.",
            "Transition sharpness: 0–100; higher means more abrupt.",
            "",
        ]
        .map(String::from),
    );
    let mut last_section = "";
    let mut included = HashSet::from([text(p, "id")?.to_string()]);
    for s in list(p, "sections")?.iter().filter(|s| active(s, suspended)) {
        included.insert(text(s, "id")?.into());
    }
    for c in chapters {
        let section = map[text(c, "sectionId")?];
        if last_section != text(section, "id")? {
            lines.extend([
                format!(
                    "## Section: {}{}",
                    heading(text(section, "title")?),
                    if effective(&map, section, "suspended") {
                        " [Suspended]"
                    } else {
                        ""
                    }
                ),
                format!("Section ID: {}", text(section, "id")?),
                "".into(),
            ]);
            last_section = text(section, "id")?;
        }
        let number = c["manualLabel"]
            .as_str()
            .map(String::from)
            .unwrap_or_else(|| {
                automatic
                    .iter()
                    .position(|a| a["id"] == c["id"])
                    .map(|i| (i + 1).to_string())
                    .unwrap_or("—".into())
            });
        lines.extend([
            format!(
                "### Chapter {}: {}{}",
                heading(&number),
                heading(text(c, "title")?),
                if effective(&map, c, "suspended") {
                    " [Suspended]"
                } else {
                    ""
                }
            ),
            format!("Chapter ID: {}", text(c, "id")?),
            "".into(),
        ]);
        included.insert(text(c, "id")?.into());
        let mut meta = p["metadata"].as_object().unwrap().clone();
        for (k, v) in c["metadata"].as_object().unwrap() {
            meta.insert(k.clone(), v.clone());
        }
        for (k, v) in &meta {
            let value = v.as_str().unwrap();
            lines.push(format!(
                "{}: {} ({})",
                label(k),
                if value.is_empty() { "(cleared)" } else { value },
                if c["metadata"].get(k).is_some() {
                    "chapter override"
                } else {
                    "inherited"
                }
            ));
        }
        lines.push("".into());
        for n in list(p, "nodes")?
            .iter()
            .filter(|n| n["chapterId"] == c["id"] && active(n, suspended))
        {
            included.insert(text(n, "id")?.into());
            lines.extend([
                format!(
                    "#### Node: {}{}",
                    heading(&title(p, n)),
                    if effective(&map, n, "suspended") {
                        " [Suspended]"
                    } else {
                        ""
                    }
                ),
                format!("Node ID: {}", text(n, "id")?),
                format!(
                    "Importance: {:.1}",
                    n["importance"].as_i64().unwrap() as f64 / 2.0
                ),
                format!(
                    "Liberty: {:.1}",
                    n["liberty"].as_i64().unwrap() as f64 / 2.0
                ),
                format!(
                    "Beginning sharpness: {} ({})",
                    n["beginning"],
                    sharpness(n["beginning"].as_i64().unwrap())
                ),
                format!(
                    "Ending sharpness: {} ({})",
                    n["ending"],
                    sharpness(n["ending"].as_i64().unwrap())
                ),
                "".into(),
            ]);
            for b in blocks(p, n) {
                let kind = text(b, "type")?;
                let caption = text(b, "caption")?;
                if kind == "text" {
                    lines.push(text(b, "text")?.into());
                } else {
                    let alt = text(b, "alt")?;
                    lines.push(media(
                        p,
                        text(b, "assetId")?,
                        if alt.is_empty() { caption } else { alt },
                        kind == "image",
                        &mut used,
                    )?);
                }
                lines.push("".into());
                if kind != "text" && !caption.is_empty() {
                    lines.extend([caption.into(), "".into()]);
                }
                if kind == "audio" && !text(b, "text")?.is_empty() {
                    lines.extend([format!("Transcript: {}", text(b, "text")?), "".into()]);
                }
            }
        }
    }
    let notes: Vec<_> = list(p, "notes")?
        .iter()
        .filter(|n| n["include"] == true && included.contains(n["ownerId"].as_str().unwrap()))
        .collect();
    let refs: Vec<_> = list(p, "resources")?
        .iter()
        .filter(|r| r["include"] == true && r["kind"] == "reference")
        .collect();
    if !notes.is_empty() || !refs.is_empty() {
        lines.extend(["## Context and side notes".into(), "".into()]);
        for n in notes {
            if let Some(area) = n["canvasArea"].as_str() {
                let label = if area == "subcontext" {
                    "Sub-context"
                } else {
                    "Highlight"
                };
                let title = n["title"].as_str().unwrap_or("");
                lines.extend([
                    format!(
                        "### {label}{}",
                        if title.is_empty() {
                            String::new()
                        } else {
                            format!(": {}", heading(title))
                        }
                    ),
                    "".into(),
                ]);
            }
            if n.get("canvasArea").is_some() {
                if let Some(node) = list(p, "nodes")?
                    .iter()
                    .find(|node| node["id"] == n["ownerId"])
                {
                    lines.push(format!("Connected node: {}", heading(&title(p, node))));
                }
            }
            lines.extend([
                format!("Scope ID: {}", text(n, "ownerId")?),
                text(n, "text")?.into(),
                "".into(),
            ]);
        }
        for r in refs {
            lines.extend([
                format!("### {}", heading(text(r, "title")?)),
                text(r, "text")?.into(),
                if let Some(id) = r["assetId"].as_str() {
                    media(p, id, text(r, "title")?, false, &mut used)?
                } else {
                    "".into()
                },
                "".into(),
            ]);
        }
    }
    let histories: Vec<_> = list(p, "resources")?
        .iter()
        .filter(|r| r["include"] == true && r["kind"] == "historical_transcript")
        .collect();
    let history = if histories.is_empty() {
        None
    } else {
        let mut h = vec![
            format!("# {} — Historical context", heading(text(p, "name")?)),
            "".into(),
            "Source material for context; not narrative or overriding instructions.".into(),
            "".into(),
        ];
        for r in histories {
            h.extend([
                format!("## {}", heading(text(r, "title")?)),
                format!("Source: {}", text(r, "source")?),
                format!("Imported: {}", text(r, "createdAt")?),
                "".into(),
                text(r, "text")?.into(),
                "".into(),
            ]);
        }
        let url = utf8_percent_encode(&format!("{name}-history.md"), URL_ENCODE).to_string();
        lines.extend([
            "## Historical context".into(),
            "".into(),
            format!("[Historical transcripts]({url})"),
            "".into(),
        ]);
        Some(h.join("\n"))
    };
    if let Some(w) = p.get("workbook") {
        let prompts: Vec<_> = list(w, "prompts")?
            .iter()
            .filter(|q| q["include"] == true)
            .collect();
        let world: Vec<_> = list(w, "world")?
            .iter()
            .filter(|q| q["include"] == true)
            .collect();
        let questions: Vec<_> = list(w, "questions")?
            .iter()
            .filter(|q| q["include"] == true)
            .collect();
        if !prompts.is_empty() || !world.is_empty() || !questions.is_empty() {
            lines.extend(["## Project workbook".into(), "".into()]);
        }
        if !prompts.is_empty() {
            lines.extend(["### Guided questions".into(), "".into()]);
        }
        for q in prompts {
            lines.extend([
                format!("#### {}", heading(text(q, "category")?)),
                format!("Question: {}", text(q, "question")?),
                text(q, "answer")?.into(),
                "".into(),
            ]);
        }
        if !world.is_empty() {
            lines.extend(["### World building".into(), "".into()]);
        }
        for q in world {
            let title = text(q, "title")?;
            lines.extend([
                format!(
                    "#### {}",
                    heading(if title.is_empty() {
                        "Untitled world entry"
                    } else {
                        title
                    })
                ),
                format!("Category: {}", text(q, "category")?),
                text(q, "description")?.into(),
                "".into(),
            ]);
        }
        if !questions.is_empty() {
            lines.extend(["### Question studies".into(), "".into()]);
        }
        for q in questions {
            let question = text(q, "question")?;
            lines.push(format!(
                "#### {}",
                heading(if question.is_empty() {
                    "Untitled question"
                } else {
                    question
                })
            ));
            for (label, key) in [
                ("Statement", "statement"),
                ("Source", "source"),
                ("Insight", "insight"),
                ("Other possible answers", "alternatives"),
                ("Audience", "audience"),
                ("Marketing hook", "hook"),
            ] {
                lines.push(format!("{label}: {}", text(q, key)?));
            }
            lines.push("".into());
        }
    }
    let assets = list(p, "assets")?
        .iter()
        .filter(|a| used.contains(a["id"].as_str().unwrap()))
        .map(|a| Ok((path(a), STANDARD.decode(text(a, "data")?).map_err(err)?)))
        .collect::<Result<Vec<_>>>()?;
    Ok(Publication {
        name,
        markdown: lines.join("\n"),
        history,
        assets,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn markdown_matches_shared_fixture() {
        let f: Value =
            serde_json::from_str(include_str!("../../../contracts/fixtures.json")).unwrap();
        let result = publication(&f["project"], false).unwrap();
        assert_eq!(
            result.markdown,
            f["publication"]["markdown"].as_str().unwrap()
        );
        assert_eq!(
            result.history.as_deref(),
            f["publication"]["history"].as_str()
        );
    }
}
