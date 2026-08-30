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

    let (paper_w, paper_h) = page_size_inches(&page_size);

    let label = format!(
        "pdf-export-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );

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
    .inner_size(794.0, 1123.0)
    .build()
    .map_err(|e| format!("failed to create hidden WebView2 window: {e}"))?;

    let (done_tx, done_rx) = mpsc::channel::<Result<String, String>>();

    let html_for_setup = html_content.clone();
    let file_path_for_setup = file_path.clone();
    window
        .with_webview(move |pw| {
            setup_and_print(pw, &html_for_setup, &file_path_for_setup, paper_w, paper_h, done_tx);
        })
        .map_err(|e| format!("failed to access the WebView2 controller: {e}"))?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        done_rx.recv_timeout(Duration::from_secs(30))
    })
    .await
    .map_err(|e| format!("internal error: {e}"))?
    .map_err(|_| "PDF export timed out".to_string())?;

    let _ = window.close();

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

        let core_for_nav = core.clone();
        let file_for_cdp = file_path_owned.clone();
        let done_tx_for_cdp = done_tx.clone();

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
                if !is_ok {
                    let _ = done_tx_for_cdp.send(Err("webview navigation failed".to_string()));
                    return Ok(());
                }

                // Wait for render to complete
                std::thread::sleep(std::time::Duration::from_secs(2));

                // Enable the Page domain
                let enable_method: Vec<u16> = "Page.enable".encode_utf16().chain(std::iter::once(0)).collect();
                let enable_params: Vec<u16> = "{}".encode_utf16().chain(std::iter::once(0)).collect();
                let enable_handler = webview2_com::CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |_result: Result<(), windows_core::Error>, _result_json: String| Ok(()),
                ));
                unsafe {
                    let _ = core_for_nav.CallDevToolsProtocolMethod(
                        PCWSTR(enable_method.as_ptr()),
                        PCWSTR(enable_params.as_ptr()),
                        &enable_handler,
                    );
                }
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Call Page.printToPDF
                let params_json = format!(
                    "{{\"landscape\":false,\"displayHeaderFooter\":false,\"printBackground\":true,\"paperWidth\":{w},\"paperHeight\":{h},\"marginTop\":0,\"marginBottom\":0,\"marginLeft\":0,\"marginRight\":0,\"preferCSSPageSize\":false}}",
                    w = paper_w,
                    h = paper_h,
                );

                let method_wide: Vec<u16> = "Page.printToPDF".encode_utf16().chain(std::iter::once(0)).collect();
                let params_wide: Vec<u16> = params_json.encode_utf16().chain(std::iter::once(0)).collect();

                let file_for_cdp_inner = file_for_cdp.clone();
                let done_tx_for_cdp_inner = done_tx_for_cdp.clone();
                let cdp_handler = webview2_com::CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |_result: Result<(), windows_core::Error>, result_json: String| {
                        match serde_json::from_str::<serde_json::Value>(&result_json) {
                            Ok(val) => {
                                if let Some(data_b64) = val.get("data").and_then(|v| v.as_str()) {
                                    match base64::Engine::decode(
                                        &base64::engine::general_purpose::STANDARD,
                                        data_b64,
                                    ) {
                                        Ok(pdf_bytes) => {
                                            if let Err(_e) = std::fs::write(&file_for_cdp_inner, &pdf_bytes) {
                                                let _ = done_tx_for_cdp_inner.send(Err("failed to write PDF file".to_string()));
                                            } else {
                                                let _ = done_tx_for_cdp_inner.send(Ok(file_for_cdp_inner));
                                            }
                                        }
                                        Err(e) => {
                                            let _ = done_tx_for_cdp_inner.send(Err(format!("base64 decode error: {e}")));
                                        }
                                    }
                                } else {
                                    let _ = done_tx_for_cdp_inner.send(Err("unexpected response from PDF renderer".to_string()));
                                }
                            }
                            Err(e) => {
                                let _ = done_tx_for_cdp_inner.send(Err(format!("JSON parse error: {e}")));
                            }
                        }
                        Ok(())
                    },
                ));

                unsafe {
                    let _ = core_for_nav.CallDevToolsProtocolMethod(
                        PCWSTR(method_wide.as_ptr()),
                        PCWSTR(params_wide.as_ptr()),
                        &cdp_handler,
                    );
                }
                Ok(())
            },
        ));

        let mut nav_token = 0;
        unsafe {
            core.add_NavigationCompleted(&nav_handler, &mut nav_token)?;
        }

        // Navigate to a data: URL with the HTML content
        let encoded: String = html_owned.bytes().map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'!' | b'*' | b'\'' | b'(' | b')' => (b as char).to_string(),
            b' ' => "%20".to_string(),
            _ => format!("%{:02X}", b),
        }).collect();
        let data_url = format!("data:text/html;charset=utf-8,{}", encoded);
        let data_url_wide: Vec<u16> = data_url.encode_utf16().chain(std::iter::once(0)).collect();
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