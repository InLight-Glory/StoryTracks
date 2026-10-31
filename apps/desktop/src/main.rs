#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde_json::Value;
use std::{io::Write, sync::Mutex};
use storytracks_core::Store;
use tauri::Manager;
struct AppState(Mutex<Store>);
#[tauri::command]
fn list_projects(state: tauri::State<AppState>) -> Result<Vec<Value>, String> {
    state.0.lock().map_err(|_| "Storage unavailable")?.list()
}
#[tauri::command]
fn save_project(
    state: tauri::State<AppState>,
    project: Value,
    expected_revision: u64,
) -> Result<Value, String> {
    state
        .0
        .lock()
        .map_err(|_| "Storage unavailable")?
        .save(project, expected_revision)
}
#[tauri::command]
fn delete_project(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Storage unavailable")?
        .delete(&id)
}
#[tauri::command]
async fn publish_project(
    state: tauri::State<'_, AppState>,
    id: String,
    revision: u64,
    include_suspended: bool,
) -> Result<bool, String> {
    let project = state
        .0
        .lock()
        .map_err(|_| "Storage unavailable")?
        .snapshot(&id, revision)?;
    let output = storytracks_core::publish::publication(&project, include_suspended)?;
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("Choose a folder for this storytrack snapshot")
        .pick_folder()
        .await
    else {
        return Ok(false);
    };
    let parent = folder.path();
    let base = format!("{}-storytrack", output.name);
    let mut destination = parent.join(&base);
    let mut suffix = 2;
    while destination.exists() {
        destination = parent.join(format!("{base}-{suffix}"));
        suffix += 1;
    }
    let staging = tempfile::tempdir_in(parent).map_err(|e| e.to_string())?;
    std::fs::write(
        staging.path().join(format!("{}-st.md", output.name)),
        output.markdown,
    )
    .map_err(|e| e.to_string())?;
    if let Some(history) = output.history {
        std::fs::write(
            staging.path().join(format!("{}-history.md", output.name)),
            history,
        )
        .map_err(|e| e.to_string())?;
    }
    if !output.assets.is_empty() {
        std::fs::create_dir(staging.path().join("assets")).map_err(|e| e.to_string())?;
    }
    for (path, bytes) in output.assets {
        std::fs::write(staging.path().join(path), bytes).map_err(|e| e.to_string())?;
    }
    std::fs::rename(staging.path(), &destination).map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
async fn write_export(filename: String, bytes: Vec<u8>) -> Result<bool, String> {
    if bytes.len() > 200 * 1024 * 1024 {
        return Err("Export exceeds the 200 MB limit.".into());
    }
    // The native dialog chooses the destination; web content cannot supply arbitrary paths.
    let safe: String = filename
        .chars()
        .filter(|c| !"<>:\"/\\|?*".contains(*c) && !c.is_control())
        .collect();
    let Some(file) = rfd::AsyncFileDialog::new()
        .set_file_name(safe)
        .save_file()
        .await
    else {
        return Ok(false);
    };
    let path = file.path();
    let parent = path.parent().ok_or("Invalid export destination.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(true)
}
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_local_data_dir()?;
            let store = Store::open(dir).map_err(std::io::Error::other)?;
            app.manage(AppState(Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            save_project,
            delete_project,
            write_export,
            publish_project
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start StoryTracks");
}
