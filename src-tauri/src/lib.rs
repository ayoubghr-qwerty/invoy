mod pdf;

pub fn run() {
    // Surface swallowed log::error! from tauri-runtime (window/webview creation failures).
    // Errors are written to stderr; visible when launched from a terminal.
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("error"))
        .try_init();

    let self_test = std::env::args().any(|a| a == "--pdf-self-test");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![pdf::export_pdf]);

    let app = if self_test {
        app.setup(|app| {
            eprintln!("[self-test] setup hook running");
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let html = r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:40px}h1{color:#1a56db}</style></head><body><h1>Self Test PDF</h1><p>Invoy self test document.</p></body></html>"#;
                let out = std::env::current_dir()
                    .map(|p| p.join("self-test-out.pdf"))
                    .unwrap_or_else(|_| std::path::PathBuf::from("self-test-out.pdf"));
                eprintln!("[self-test] invoking export_pdf, out={}", out.display());
                let start = std::time::Instant::now();
                let result = pdf::export_pdf(
                    handle,
                    html.to_string(),
                    out.to_string_lossy().to_string(),
                    "A4".to_string(),
                )
                .await;
                eprintln!(
                    "[self-test] export_pdf finished in {:?} => {:?}",
                    start.elapsed(),
                    result
                );
                std::process::exit(if result.is_ok() { 0 } else { 3 });
            });
            Ok(())
        })
    } else {
        app
    };

    app.run(tauri::generate_context!())
        .expect("error while running tauri application");
}
