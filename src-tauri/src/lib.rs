use walkdir::WalkDir;
use serde::{Serialize, Deserialize};

pub mod thumbnail;

#[derive(Serialize, Deserialize, Clone)]
pub struct ScannedFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_type: String,
}

#[tauri::command]
async fn scan_media_directory(path: String) -> Result<Vec<ScannedFile>, String> {
    println!("scan_media_directory called with path: {}", path);
    let mut files = Vec::new();
    
    // We only care about media files
    let allowed_extensions = [
        // Video
        "mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "m4v", "ts", "mts", "m2ts", "vob", "ogv", "3gp",
        // Audio
        "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"
    ];
    
    println!("Starting WalkDir for path: {}", path);
    for entry_result in WalkDir::new(&path).into_iter() {
        match entry_result {
            Ok(entry) => {
                let path_buf = entry.path();
                if path_buf.is_file() {
                    if let Some(ext) = path_buf.extension() {
                        if let Some(ext_str) = ext.to_str() {
                            let ext_lower = ext_str.to_lowercase();
                            if allowed_extensions.contains(&ext_lower.as_str()) {
                                let name = entry.file_name().to_string_lossy().into_owned();
                                let abs_path = path_buf.to_string_lossy().into_owned();
                                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                                
                                let file_type = match ext_lower.as_str() {
                                    "mp4" | "m4v" => "video/mp4".to_string(),
                                    "mkv" => "video/x-matroska".to_string(),
                                    "webm" => "video/webm".to_string(),
                                    "ogg" | "ogv" => "video/ogg".to_string(),
                                    "mp3" => "audio/mpeg".to_string(),
                                    "wav" => "audio/wav".to_string(),
                                    "flac" => "audio/flac".to_string(),
                                    "aac" => "audio/aac".to_string(),
                                    "m4a" => "audio/mp4".to_string(),
                                    "wma" => "audio/x-ms-wma".to_string(),
                                    _ => format!("video/{}", ext_lower),
                                };
                                
                                files.push(ScannedFile {
                                    name,
                                    path: abs_path,
                                    size,
                                    file_type
                                });
                            }
                        }
                    }
                }
            }
            Err(e) => {
                println!("WalkDir error: {:?}", e);
            }
        }
    }
    println!("scan_media_directory found {} files", files.len());
    
    Ok(files)
}

#[tauri::command]
fn quit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            thumbnail::get_video_thumbnail,
            scan_media_directory,
            thumbnail::get_first_valid_thumbnail,
            quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
