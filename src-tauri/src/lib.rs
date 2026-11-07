// Ozone PDF 2 — Pache Labs. La app no hace conexiones de red: todo el trabajo con el PDF
// ocurre en el motor local (MuPDF) dentro de la ventana.

/// Si la app se abrió con "Abrir con… Ozone PDF", devuelve la ruta del PDF.
#[tauri::command]
fn archivo_inicial() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".pdf"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![archivo_inicial])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Ozone PDF");
}
