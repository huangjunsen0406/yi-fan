use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Store the most recent screenshot/cut paths so downstream commands can reference them.
static LAST_SCREENSHOT_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static LAST_CUT_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Generate a unique temp path with the given prefix and extension.
fn unique_temp_path(prefix: &str, ext: &str) -> PathBuf {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let mut p = std::env::temp_dir();
    p.push(format!("{}_{}{}", prefix, ts, ext));
    p
}

/// Capture the full screen screenshot (primary monitor)
#[tauri::command]
pub fn screenshot() -> Result<String, String> {
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found")?;
    let capture = screen.capture().map_err(|e| e.to_string())?;

    let path = unique_temp_path("yi_fan_screenshot", ".png");
    capture.save(&path).map_err(|e| e.to_string())?;

    // Store path for downstream commands (cut_image, get_base64)
    if let Ok(mut last) = LAST_SCREENSHOT_PATH.lock() {
        *last = Some(path.clone());
    }

    Ok(path.to_string_lossy().to_string())
}

/// Cut a region from the screenshot
#[tauri::command]
pub fn cut_image(left: u32, top: u32, width: u32, height: u32) -> Result<String, String> {
    let path = LAST_SCREENSHOT_PATH
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Screenshot not found (no prior screenshot taken)")?;

    if !path.exists() {
        return Err("Screenshot file not found on disk".to_string());
    }

    let img = image::open(&path).map_err(|e| e.to_string())?;
    let cropped = img.crop_imm(left, top, width, height);

    let cut_path = unique_temp_path("yi_fan_screenshot_cut", ".png");
    cropped.save(&cut_path).map_err(|e| e.to_string())?;

    // Store cut path for get_base64
    if let Ok(mut last) = LAST_CUT_PATH.lock() {
        *last = Some(cut_path.clone());
    }

    Ok(cut_path.to_string_lossy().to_string())
}

/// Get base64 encoded string of the cut screenshot
#[tauri::command]
pub fn get_base64() -> Result<String, String> {
    let path = LAST_CUT_PATH
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Cut screenshot not found (no prior cut performed)")?;

    if !path.exists() {
        return Err("Cut screenshot file not found on disk".to_string());
    }

    let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    Ok(general_purpose::STANDARD.encode(&buffer))
}

/// macOS system OCR using Vision framework via Swift CLI
#[tauri::command]
#[allow(unused_variables)]
pub fn system_ocr(lang: String) -> Result<String, String> {
    let path = LAST_CUT_PATH
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Cut screenshot not found (no prior cut performed)")?;

    if !path.exists() {
        return Err("Cut screenshot file not found on disk".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        // Escape path for safe embedding in Swift string literal
        let escaped_path = path.to_string_lossy().replace("\\", "\\\\").replace("\"", "\\\"");
        let escaped_lang = lang.replace("\\", "\\\\").replace("\"", "\\\"");
        let script = format!(
            r#"
import AppKit
import Vision

let imagePath = "{}"
guard let nsImage = NSImage(contentsOfFile: imagePath),
      let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {{
    fputs("ERROR: Cannot load image\n", stderr)
    exit(1)
}}

let semaphore = DispatchSemaphore(value: 0)
var resultText = ""

let request = VNRecognizeTextRequest {{ request, error in
    if let error = error {{
        fputs("OCR error: \(error)\n", stderr)
        semaphore.signal()
        return
    }}
    guard let observations = request.results as? [VNRecognizedTextObservation] else {{
        semaphore.signal()
        return
    }}
    for observation in observations {{
        if let candidate = observation.topCandidates(1).first {{
            resultText += candidate.string + "\n"
        }}
    }}
    semaphore.signal()
}}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
if #available(macOS 13.0, *) {{
    request.revision = VNRecognizeTextRequestRevision3
    request.automaticallyDetectsLanguage = true
}}
let lang = "{}"
if lang == "auto" {{
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US", "ja", "ko-KR", "fr-FR", "de-DE", "es-ES", "pt-BR", "it-IT", "ru-RU"]
}} else {{
    request.recognitionLanguages = [lang]
}}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {{
    try handler.perform([request])
}} catch {{
    fputs("ERROR: \(error)\n", stderr)
    exit(1)
}}
semaphore.wait()

print(resultText, terminator: "")
"#,
            escaped_path,
            escaped_lang
        );

        let mut script_path = std::env::temp_dir();
        script_path.push("yi_fan_ocr.swift");
        fs::write(&script_path, &script).map_err(|e| e.to_string())?;

        let output = std::process::Command::new("swift")
            .arg(&script_path)
            .output()
            .map_err(|e| format!("Failed to execute swift: {}", e))?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            Ok(text.trim().to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("OCR failed: {}", err))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("System OCR is only supported on macOS".to_string())
    }
}

/// macOS: Use native screencapture -i -r for interactive region selection
/// Saves directly to a unique temp path, much smoother UX than custom window
#[tauri::command]
pub fn screencapture_select() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let path = unique_temp_path("yi_fan_screenshot_cut", ".png");
        let output = std::process::Command::new("/usr/sbin/screencapture")
            .arg("-i") // interactive mode
            .arg("-r") // no shadow/border
            .arg(path.to_string_lossy().to_string())
            .output()
            .map_err(|e| format!("screencapture failed: {}", e))?;

        let exists = path.exists();
        if exists {
            // Store the cut path for downstream commands (system_ocr, get_base64)
            if let Ok(mut last) = LAST_CUT_PATH.lock() {
                *last = Some(path);
            }
        }

        // If user cancelled (Esc), the file won't exist
        Ok(output.status.success() && exists)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("screencapture is only available on macOS".to_string())
    }
}

/// Get currently selected text using the `selection` crate (same as pot-desktop)
#[tauri::command]
pub fn get_selected_text() -> Result<String, String> {
    use selection::get_text;
    let text = get_text();
    Ok(text.trim().to_string())
}

/// Clean up old yi_fan temp screenshot files (older than 1 hour).
/// Called once at app startup.
pub fn cleanup_old_temp_files() {
    let temp_dir = std::env::temp_dir();
    let one_hour_ago = SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(3600))
        .unwrap_or(SystemTime::UNIX_EPOCH);

    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("yi_fan_screenshot") && name.ends_with(".png") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified < one_hour_ago {
                            let _ = fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
    }
}
