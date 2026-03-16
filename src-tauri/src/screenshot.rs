use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::io::Read;
use std::path::PathBuf;

/// Get temp path for screenshot files
fn screenshot_path() -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push("yi_fan_screenshot.png");
    p
}

fn cut_screenshot_path() -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push("yi_fan_screenshot_cut.png");
    p
}

/// Capture the full screen screenshot (primary monitor)
#[tauri::command]
pub fn screenshot() -> Result<String, String> {
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found")?;
    let capture = screen.capture().map_err(|e| e.to_string())?;

    // screenshots crate returns an RgbaImage (image::ImageBuffer)
    let path = screenshot_path();
    capture.save(&path).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

/// Cut a region from the screenshot
#[tauri::command]
pub fn cut_image(left: u32, top: u32, width: u32, height: u32) -> Result<String, String> {
    let path = screenshot_path();
    if !path.exists() {
        return Err("Screenshot not found".to_string());
    }

    let img = image::open(&path).map_err(|e| e.to_string())?;
    let cropped = img.crop_imm(left, top, width, height);

    let cut_path = cut_screenshot_path();
    cropped.save(&cut_path).map_err(|e| e.to_string())?;

    Ok(cut_path.to_string_lossy().to_string())
}

/// Get base64 encoded string of the cut screenshot
#[tauri::command]
pub fn get_base64() -> Result<String, String> {
    let path = cut_screenshot_path();
    if !path.exists() {
        return Err("Cut screenshot not found".to_string());
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
    let path = cut_screenshot_path();
    if !path.exists() {
        return Err("Cut screenshot not found".to_string());
    }

    #[cfg(target_os = "macos")]
    {
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
            path.to_string_lossy(),
            lang
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
/// Saves directly to cut_screenshot_path, much smoother UX than custom window
#[tauri::command]
pub fn screencapture_select() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let path = cut_screenshot_path();
        let output = std::process::Command::new("/usr/sbin/screencapture")
            .arg("-i") // interactive mode
            .arg("-r") // no shadow/border
            .arg(path.to_string_lossy().to_string())
            .output()
            .map_err(|e| format!("screencapture failed: {}", e))?;

        // If user cancelled (Esc), the file won't exist
        Ok(output.status.success() && path.exists())
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
