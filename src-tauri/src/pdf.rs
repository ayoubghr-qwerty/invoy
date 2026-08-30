//! HTML → PDF export through a hidden WebView2 window using the silent
//! direct-to-file `ICoreWebView2_7::PrintToPdf` API (no printer / save dialog).
//!
//! Windows-only: WebView2 COM objects are not `Send` and must be touched on the
//! UI thread. We therefore set up everything and fire off the export inside a
//! `with_webview` closure on the UI thread, and only move channel senders
//! between threads.

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
    use base64::Engine;
    use std::sync::mpsc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    let (page_w, page_h) = page_size_dips(&page_size);

    let b64 = base64::engine::general_purpose::STANDARD.encode(html_content.as_bytes());
    let url = format!("data:text/html;base64,{b64}");

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
    .inner_size(1.0, 1.0)
    .build()
    .map_err(|e| format!("failed to create hidden WebView2 window: {e}"))?;

    let (nav_tx, nav_rx) = mpsc::channel::<Result<(), String>>();
    let (print_tx, print_rx) = mpsc::channel::<Result<bool, String>>();

    let file_path_for_setup = file_path.clone();
    window
        .with_webview(move |pw| {
            setup_and_print(
                pw,
                &url,
                &file_path_for_setup,
                (page_w, page_h),
                nav_tx,
                print_tx,
            );
        })
        .map_err(|e| format!("failed to access the WebView2 controller: {e}"))?;

    let nav = tauri::async_runtime::spawn_blocking(move || {
        nav_rx.recv_timeout(Duration::from_secs(30))
    })
    .await
        .map_err(|e| format!("internal error joining the navigation task: {e}"))?
        .map_err(|_| "PDF export timed out while the hidden window loaded the document")?;

    if let Err(e) = nav {
        let _ = window.close();
        return Err(format!("PDF export failed while loading the document: {e}"));
    }

    let print =
        tauri::async_runtime::spawn_blocking(move || print_rx.recv_timeout(Duration::from_secs(30)))
            .await
            .map_err(|e| format!("internal error joining the print task: {e}"))?
            .map_err(|_| "PDF export timed out while waiting for PrintToPdf")?;

    let _ = window.close();

    match print {
        Ok(ok) => Ok(ok),
        Err(e) => Err(e),
    }
}

#[cfg(target_os = "windows")]
fn page_size_dips(page_size: &str) -> (f64, f64) {
    match page_size.trim().to_uppercase().as_str() {
        // WebView2 print margins/sizes are in DIPs at 96 DIP/inch.
        "A5" => (559.0, 794.0),
        _ => (794.0, 1123.0), // A4 (default)
    }
}

#[cfg(target_os = "windows")]
fn setup_and_print(
    pw: tauri::webview::PlatformWebview,
    url: &str,
    file_path: &str,
    (page_w, page_h): (f64, f64),
    nav_tx: std::sync::mpsc::Sender<Result<(), String>>,
    print_tx: std::sync::mpsc::Sender<Result<bool, String>>,
) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2Environment6, ICoreWebView2NavigationCompletedEventArgs,
        ICoreWebView2_7,
    };
    use webview2_com::{NavigationCompletedEventHandler, PrintToPdfCompletedHandler};
    use windows_core::{Interface, PCWSTR};

    let result = (|| -> windows_core::Result<()> {
        let controller = pw.controller();
        let core = unsafe { controller.CoreWebView2()? };
        let webview = core.cast::<ICoreWebView2_7>()?;
        let environment = pw.environment().cast::<ICoreWebView2Environment6>()?;
        let settings = unsafe { environment.CreatePrintSettings()? };
        unsafe {
            settings.SetPageWidth(page_w)?;
            settings.SetPageHeight(page_h)?;
            // Full-bleed, matching Electron's `marginsType: 2`.
            settings.SetMarginTop(0.0)?;
            settings.SetMarginBottom(0.0)?;
            settings.SetMarginLeft(0.0)?;
            settings.SetMarginRight(0.0)?;
            // Colors matter; the document relies on print backgrounds.
            settings.SetShouldPrintBackgrounds(true)?;
        }

        let nav_tx = nav_tx.clone();
        let print_tx = print_tx.clone();
        let file_path = file_path.to_string();
        let webview = webview.clone();
        let settings = settings.clone();

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
                if is_ok {
                    let path_wide: Vec<u16> =
                        file_path.encode_utf16().chain(std::iter::once(0)).collect();
                    let print_tx = print_tx.clone();
                    let print_handler = PrintToPdfCompletedHandler::create(Box::new(
                        move |errorcode, result| {
                            // `errorcode` is `Result<()>`, `result` is already a `bool`
                            // (converted from BOOL by webview2-com's handler shim).
                            let message = if errorcode.is_ok() && result {
                                Ok(true)
                            } else {
                                Err(format!(
                                    "PrintToPdf failed (hresult {errorcode:#?}, success {result})"
                                ))
                            };
                            let _ = print_tx.send(message);
                            Ok(())
                        },
                    ));
                    unsafe {
                        let _ = webview.PrintToPdf(
                            PCWSTR(path_wide.as_ptr()),
                            &settings,
                            &print_handler,
                        );
                    }
                    let _ = nav_tx.send(Ok(()));
                } else {
                    let msg =
                        "the webview navigation to the document failed or was cancelled".to_string();
                    let _ = nav_tx.send(Err(msg.clone()));
                    let _ = print_tx.send(Err(msg));
                }
                Ok(())
            },
        ));

        let mut token = 0;
        unsafe {
            core.add_NavigationCompleted(&nav_handler, &mut token)?;
        }
        let url_wide: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            core.Navigate(PCWSTR(url_wide.as_ptr()))?;
        }
        Ok(())
    })();

    if let Err(e) = result {
        let msg = format!("failed to set up WebView2 PDF export: {e}");
        let _ = nav_tx.send(Err(msg.clone()));
        let _ = print_tx.send(Err(msg));
    }
}