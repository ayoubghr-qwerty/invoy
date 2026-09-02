//! HTML → PDF export through a hidden WebView2 window using the DevTools
//! Protocol `Page.printToPDF` command via `ICoreWebView2::CallDevToolsProtocolMethod`.
//!
//! Navigates to a `data:` URL (gives a proper origin for CDP) then calls
//! `Page.enable` + `Page.printToPDF` to produce the PDF file.

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn export_pdf(
    _app: tauri::AppHandle,
    _html_content: String,
    _file_path: String,
    _page_size: String,
) -> Result<bool, String> {
    Err("PDF export requires Windows".into())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn export_pdf(
    app: tauri::AppHandle,
    html_content: String,
    file_path: String,
    page_size: String,
) -> Result<bool, String> {
    use std::sync::mpsc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    // Input validation
    if page_size.trim().to_uppercase() != "A4" && page_size.trim().to_uppercase() != "A5" {
        return Err(format!("unsupported page size: {page_size}"));
    }
    if !file_path.to_lowercase().ends_with(".pdf") {
        return Err("file path must end with .pdf".to_string());
    }
    if html_content.len() > 2_000_000 {
        return Err(format!(
            "document trop volumineux pour l'export PDF ({} caractères, max 2 000 000)",
            html_content.len()
        ));
    }

    let (paper_w, paper_h) = page_size_inches(&page_size);
    eprintln!(
        "[pdf-export] stage 1: command invoked, html_len={}, file={}",
        html_content.len(),
        file_path
    );

    let label = format!(
        "pdf-export-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );

    // Hidden window: invisible, never flashes on screen.
    // CRITICAL: browser args MUST match tauri.conf.json's additionalBrowserArgs exactly.
    // Mismatched args => second WebView2 environment for the same user-data folder
    // => HRESULT 0x8007139F (ERROR_INVALID_STATE) on CreateCoreWebView2Controller.
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(
            "about:blank"
                .parse::<tauri::Url>()
                .map_err(|e| e.to_string())?,
        ),
    )
    .title("PDF Export")
    .visible(false)
    .decorations(false)
    .skip_taskbar(true)
    .inner_size(794.0, 1123.0) // A4 at 96 DPI
    .additional_browser_args(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,ElasticOverscroll",
    )
    .build()
    .map_err(|e| format!("failed to create WebView2 window: {e}"))?;
    eprintln!(
        "[pdf-export] stage 2: window created (label={}, hidden)",
        label
    );

    let (done_tx, done_rx) = mpsc::channel::<Result<String, String>>();

    let html_for_setup = html_content.clone();
    let file_path_for_setup = file_path.clone();
    let window_clone = window.clone();

    // with_webview will wait for the WebView2 controller to be ready
    if let Err(e) = window.with_webview(move |pw| {
        eprintln!("[pdf-export] stage 3: with_webview callback fired");
        setup_and_print(
            pw,
            &html_for_setup,
            &file_path_for_setup,
            paper_w,
            paper_h,
            done_tx,
        );
    }) {
        // Never leak the window on error
        let _ = window.close();
        return Err(format!("failed to access the WebView2 controller: {e}"));
    }
    eprintln!("[pdf-export] stage 4: with_webview registered, entering wait (60s timeout)");

    let result = tauri::async_runtime::spawn_blocking(move || {
        // Increase timeout to 60 seconds to allow for slow WebView2 initialization
        done_rx.recv_timeout(Duration::from_secs(60))
    })
    .await
    .map_err(|e| format!("internal error: {e}"))?
    .map_err(|e| {
        match e {
            mpsc::RecvTimeoutError::Timeout => {
                eprintln!("[pdf-export] TIMEOUT: no response within 60 seconds (callback never ran)");
                "PDF export timed out (60s) - with_webview callback never fired".to_string()
            }
            mpsc::RecvTimeoutError::Disconnected => {
                eprintln!("[pdf-export] DISCONNECTED: channel closed without receiving - with_webview closure was DROPPED without executing");
                "PDF export failed: webview callback was dropped (window/webview lookup failed in runtime)".to_string()
            }
        }
    });

    eprintln!("[pdf-export] stage 5: closing window (label={})", label);
    let _ = window_clone.close();

    match result {
        Ok(_path) => Ok(true),
        Err(e) => Err(e),
    }
}

#[cfg(target_os = "windows")]
fn page_size_inches(page_size: &str) -> (f64, f64) {
    match page_size.trim().to_uppercase().as_str() {
        "A5" => (5.83, 8.27),
        _ => (8.27, 11.69), // A4 (default)
    }
}

#[cfg(target_os = "windows")]
fn setup_and_print(
    pw: tauri::webview::PlatformWebview,
    html_content: &str,
    file_path: &str,
    paper_w: f64,
    paper_h: f64,
    done_tx: std::sync::mpsc::Sender<Result<String, String>>,
) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2NavigationCompletedEventArgs,
    };
    use webview2_com::NavigationCompletedEventHandler;
    use windows_core::PCWSTR;

    let html_owned = html_content.to_string();
    let file_path_owned = file_path.to_string();
    let done_tx_for_nav_err = done_tx.clone();

    let result = (|| -> windows_core::Result<()> {
        let controller = pw.controller();
        let core = unsafe { controller.CoreWebView2()? };
        eprintln!("[pdf-export] stage 4a: got CoreWebView2, registering nav handler");

        let core_for_nav = core.clone();
        let file_for_cdp = file_path_owned.clone();
        let done_tx_for_cdp = done_tx.clone();
        let printed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let printed_clone = printed.clone();

        let nav_handler = NavigationCompletedEventHandler::create(Box::new(
            move |_sender: Option<ICoreWebView2>,
                  args: Option<ICoreWebView2NavigationCompletedEventArgs>| {
                let is_ok = match &args {
                    Some(a) => {
                        let mut success = windows_core::BOOL::default();
                        let call_ok = unsafe { a.IsSuccess(&mut success) }.is_ok();
                        call_ok && success.as_bool()
                    }
                    None => false,
                };
                eprintln!("[pdf-export] stage 4b: NavigationCompleted fired, is_ok={is_ok}");
                if !is_ok {
                    let _ = done_tx_for_cdp.send(Err("webview navigation failed".to_string()));
                    return Ok(());
                }

                // Guard: print only once even if navigation events repeat
                if printed_clone.swap(true, std::sync::atomic::Ordering::SeqCst) {
                    eprintln!("[pdf-export] stage 4b: already printed, ignoring repeat navigation");
                    return Ok(());
                }

                // Wait for render. Fixed sleep: a CDP Runtime.evaluate poll was
                // tried but the callback needs the UI-thread message pump, which
                // a blocking recv stalls (wait_with_pump conflicts with the
                // NavigationCompleted handler). 3s covers large invoices.
                std::thread::sleep(std::time::Duration::from_secs(3));
                eprintln!("[pdf-export] stage 4c: render wait done, calling Page.enable");

                // Enable the Page domain
                let enable_method: Vec<u16> = "Page.enable"
                    .encode_utf16()
                    .chain(std::iter::once(0))
                    .collect();
                let enable_params: Vec<u16> =
                    "{}".encode_utf16().chain(std::iter::once(0)).collect();
                let enable_handler =
                    webview2_com::CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                        move |_result: Result<(), windows_core::Error>, _result_json: String| {
                            eprintln!("[pdf-export] stage 4d: Page.enable responded");
                            Ok(())
                        },
                    ));
                unsafe {
                    let hr = core_for_nav.CallDevToolsProtocolMethod(
                        PCWSTR(enable_method.as_ptr()),
                        PCWSTR(enable_params.as_ptr()),
                        &enable_handler,
                    );
                    eprintln!("[pdf-export] stage 4c-result: Page.enable call = {:?}", hr);
                }
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Call Page.printToPDF
                let params_json = format!(
                    "{{\"landscape\":false,\"displayHeaderFooter\":false,\"printBackground\":true,\"paperWidth\":{w},\"paperHeight\":{h},\"marginTop\":0,\"marginBottom\":0,\"marginLeft\":0,\"marginRight\":0,\"preferCSSPageSize\":false}}",
                    w = paper_w,
                    h = paper_h,
                );

                let method_wide: Vec<u16> = "Page.printToPDF"
                    .encode_utf16()
                    .chain(std::iter::once(0))
                    .collect();
                let params_wide: Vec<u16> = params_json
                    .encode_utf16()
                    .chain(std::iter::once(0))
                    .collect();
                eprintln!(
                    "[pdf-export] stage 4e: calling Page.printToPDF ({} bytes params)",
                    params_json.len()
                );

                let file_for_cdp_inner = file_for_cdp.clone();
                let done_tx_for_cdp_inner = done_tx_for_cdp.clone();
                let cdp_handler = webview2_com::CallDevToolsProtocolMethodCompletedHandler::create(
                    Box::new(
                        move |result: Result<(), windows_core::Error>, result_json: String| {
                            eprintln!(
                                "[pdf-export] stage 4f: printToPDF responded, json_len={}",
                                result_json.len()
                            );
                            if let Err(e) = &result {
                                eprintln!("[pdf-export] stage 4f: printToPDF returned error: {e}");
                            }
                            match serde_json::from_str::<serde_json::Value>(&result_json) {
                                Ok(val) => {
                                    if let Some(data_b64) = val.get("data").and_then(|v| v.as_str())
                                    {
                                        eprintln!(
                                            "[pdf-export] stage 4g: got base64 data, len={}",
                                            data_b64.len()
                                        );
                                        match base64::Engine::decode(
                                            &base64::engine::general_purpose::STANDARD,
                                            data_b64,
                                        ) {
                                            Ok(pdf_bytes) => {
                                                eprintln!("[pdf-export] stage 4h: decoded {} pdf bytes, writing file", pdf_bytes.len());
                                                if let Err(e) =
                                                    std::fs::write(&file_for_cdp_inner, &pdf_bytes)
                                                {
                                                    eprintln!("[pdf-export] stage 4h: FAILED to write file: {e}");
                                                    let _ = done_tx_for_cdp_inner.send(Err(
                                                        format!("failed to write PDF file: {e}"),
                                                    ));
                                                } else {
                                                    let _ = done_tx_for_cdp_inner
                                                        .send(Ok(file_for_cdp_inner));
                                                }
                                            }
                                            Err(e) => {
                                                let _ = done_tx_for_cdp_inner
                                                    .send(Err(format!("base64 decode error: {e}")));
                                            }
                                        }
                                    } else {
                                        eprintln!("[pdf-export] stage 4g: NO 'data' field in response: {}", &result_json[..result_json.len().min(200)]);
                                        let _ =
                                            done_tx_for_cdp_inner
                                                .send(Err("unexpected response from PDF renderer"
                                                    .to_string()));
                                    }
                                }
                                Err(e) => {
                                    let _ = done_tx_for_cdp_inner
                                        .send(Err(format!("JSON parse error: {e}")));
                                }
                            }
                            Ok(())
                        },
                    ),
                );

                unsafe {
                    let hr = core_for_nav.CallDevToolsProtocolMethod(
                        PCWSTR(method_wide.as_ptr()),
                        PCWSTR(params_wide.as_ptr()),
                        &cdp_handler,
                    );
                    eprintln!("[pdf-export] stage 4e-result: printToPDF call = {:?}", hr);
                }
                Ok(())
            },
        ));

        let mut nav_token = 0;
        unsafe {
            core.add_NavigationCompleted(&nav_handler, &mut nav_token)?;
        }
        eprintln!(
            "[pdf-export] stage 4a1: nav handler registered, building data: URL (html_len={})",
            html_owned.len()
        );

        // Navigate to a data: URL with the HTML content
        let encoded: String = html_owned
            .bytes()
            .map(|b| match b {
                b'A'..=b'Z'
                | b'a'..=b'z'
                | b'0'..=b'9'
                | b'-'
                | b'_'
                | b'.'
                | b'~'
                | b'!'
                | b'*'
                | b'\''
                | b'('
                | b')' => (b as char).to_string(),
                b' ' => "%20".to_string(),
                _ => format!("%{:02X}", b),
            })
            .collect();
        let data_url = format!("data:text/html;charset=utf-8,{}", encoded);
        let data_url_wide: Vec<u16> = data_url.encode_utf16().chain(std::iter::once(0)).collect();
        eprintln!(
            "[pdf-export] stage 4a2: navigating to data: URL (len={})",
            data_url.len()
        );
        unsafe {
            core.Navigate(PCWSTR(data_url_wide.as_ptr()))?;
        }
        Ok(())
    })();

    if let Err(_e) = result {
        let msg = "failed to initialize PDF export".to_string();
        let _ = done_tx_for_nav_err.send(Err(msg));
    }
}
