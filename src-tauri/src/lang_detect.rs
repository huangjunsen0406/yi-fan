use lingua::{Language, LanguageDetectorBuilder};

/// Detect the language of the given text.
/// Returns a Chinese display name like "英语", "简体中文", "日语", etc.
#[tauri::command]
pub fn detect_language(text: String) -> String {
    if text.trim().is_empty() {
        return String::new();
    }

    let languages = vec![
        Language::Chinese,
        Language::English,
        Language::Japanese,
        Language::Korean,
        Language::French,
        Language::German,
        Language::Spanish,
        Language::Russian,
        Language::Portuguese,
        Language::Italian,
        Language::Dutch,
        Language::Arabic,
    ];

    let detector = LanguageDetectorBuilder::from_languages(&languages)
        .with_minimum_relative_distance(0.15)
        .build();

    match detector.detect_language_of(&text) {
        Some(lang) => match lang {
            Language::Chinese => "简体中文".to_string(),
            Language::English => "英语".to_string(),
            Language::Japanese => "日语".to_string(),
            Language::Korean => "韩语".to_string(),
            Language::French => "法语".to_string(),
            Language::German => "德语".to_string(),
            Language::Spanish => "西班牙语".to_string(),
            Language::Russian => "俄语".to_string(),
            Language::Portuguese => "葡萄牙语".to_string(),
            Language::Italian => "意大利语".to_string(),
            Language::Dutch => "荷兰语".to_string(),
            Language::Arabic => "阿拉伯语".to_string(),
        },
        None => String::new(),
    }
}
