// Ozone PDF 2 — Pache Labs. La app no hace conexiones de red: todo el trabajo con el PDF
// ocurre en el motor local (MuPDF) dentro de la ventana.

/// PDF que otra app mandó a abrir (en el celular: "Abrir con…" o "Compartir" desde WhatsApp, Gmail, Archivos).
struct Pendiente(std::sync::Mutex<Option<String>>);

/// Si la app se abrió con "Abrir con… Ozone PDF", devuelve la ruta (o la dirección content:// en Android).
/// Se entrega una sola vez.
#[tauri::command]
fn archivo_inicial(pendiente: tauri::State<Pendiente>) -> Option<String> {
    if let Some(u) = pendiente.0.lock().ok().and_then(|mut x| x.take()) {
        return Some(u);
    }
    static LEIDO: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if LEIDO.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return None;
    }
    std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".pdf"))
}

/// De dónde se instaló: "tienda" si es el paquete de Microsoft Store (las apps MSIX viven en
/// WindowsApps y se actualizan solas), "directo" si vino del instalador de la página.
#[tauri::command]
fn origen_instalacion() -> String {
    // en el celular se instala y se actualiza desde la tienda del sistema
    if cfg!(target_os = "android") {
        return "play".into();
    }
    if cfg!(target_os = "ios") {
        return "appstore".into();
    }
    let ruta = std::env::current_exe().map(|p| p.to_string_lossy().to_lowercase()).unwrap_or_default();
    if ruta.contains("\\windowsapps\\") { "tienda".into() } else { "directo".into() }
}

/// Carpetas que OneDrive sincroniza con la nube, leídas del registro local de Windows
/// (cuentas personales, de la organización y bibliotecas de SharePoint/Teams). No usa la red.
#[cfg(windows)]
fn carpetas_onedrive() -> Vec<String> {
    use std::os::windows::process::CommandExt;
    let mut rutas: Vec<String> = ["OneDrive", "OneDriveCommercial", "OneDriveConsumer"]
        .iter()
        .filter_map(|v| std::env::var(v).ok())
        .collect();
    let salida = std::process::Command::new("reg")
        .args(["query", r"HKCU\Software\Microsoft\OneDrive\Accounts", "/s"])
        .creation_flags(0x0800_0000) // sin ventana de consola
        .output();
    if let Ok(s) = salida {
        let texto = String::from_utf8_lossy(&s.stdout);
        let mut clave = String::new();
        for linea in texto.lines() {
            if linea.starts_with("HKEY_") {
                clave = linea.to_lowercase();
                continue;
            }
            // formato:  "    Nombre    REG_SZ    Valor"
            let Some(pos) = linea.find("    REG_") else { continue };
            let nombre = linea[..pos].trim();
            let resto = &linea[pos + 4..];
            let valor = resto.splitn(2, "    ").nth(1).unwrap_or("").trim();
            let absoluta = |x: &str| x.len() > 2 && x.as_bytes()[1] == b':';
            if nombre.eq_ignore_ascii_case("UserFolder") && absoluta(valor) {
                rutas.push(valor.to_string());
            } else if clave.ends_with("scopeidtomountpointpathcache") && absoluta(valor) {
                rutas.push(valor.to_string());
            } else if clave.contains("\\tenants\\") && absoluta(nombre) {
                rutas.push(nombre.to_string());
            }
        }
    }
    rutas
}
#[cfg(not(windows))]
fn carpetas_onedrive() -> Vec<String> {
    Vec::new()
}

fn normalizar(r: &str) -> String {
    let mut x = r.replace('\\', "/").to_lowercase();
    while x.ends_with('/') {
        x.pop();
    }
    x
}

/// Si la ruta está en una carpeta que se sube a la nube (OneDrive, Google Drive, Dropbox,
/// iCloud…), devuelve esa carpeta para avisarle a la persona antes de guardar.
#[tauri::command]
fn carpeta_nube(ruta: String) -> Option<String> {
    let destino = normalizar(&ruta);
    for base in carpetas_onedrive() {
        let b = normalizar(&base);
        if !b.is_empty() && (destino == b || destino.starts_with(&(b.clone() + "/"))) {
            return Some(base);
        }
    }
    // otros servicios: se reconocen por el nombre de sus carpetas
    let original: Vec<&str> = ruta.split(['/', '\\']).collect();
    let partes: Vec<String> = original.iter().map(|p| p.to_lowercase()).collect();
    for (i, p) in partes.iter().enumerate() {
        let siguiente = partes.get(i + 1).map(String::as_str).unwrap_or("");
        let es_nube = p.starts_with("onedrive")
            || p == "google drive" || p == "googledrive" || p == "mi unidad" || p == "my drive"
            || p == "dropbox" || p.starts_with("dropbox (")
            || p == "icloud drive" || p == "iclouddrive" || p == "mobile documents"
            || p == "pcloud drive" || p == "nextcloud" || p == "mega"
            || (p == "library" && siguiente == "cloudstorage");
        if es_nube {
            let fin = if p == "library" { i + 3 } else { i + 1 };
            return Some(original[..fin.min(original.len())].join("/"));
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(Pendiente(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // solo abre en el navegador de la persona los enlaces de Pache Labs y Cafecito (la app no se conecta)
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // la ventana abre a un tamaño que entra en la pantalla, para no tener que scrollear el inicio
            // en el celular la app ocupa toda la pantalla: esto es solo para la compu
            #[cfg(desktop)]
            if let Some(w) = tauri::Manager::get_webview_window(app, "main") {
                if let Ok(Some(m)) = w.current_monitor() {
                    let esc = m.scale_factor();
                    let area = m.work_area().size;
                    let (aw, ah) = (area.width as f64 / esc, area.height as f64 / esc);
                    let ancho = (aw * 0.92).min(1280.0).max(360.0);
                    let alto = (ah * 0.97).min(880.0).max(480.0);
                    let _ = w.set_size(tauri::LogicalSize::new(ancho, alto));
                    let _ = w.center();
                }
                let _ = w.show();
            }
            #[cfg(mobile)]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![archivo_inicial, carpeta_nube, origen_instalacion])
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Ozone PDF");
    app.run(|_app, _evento| {
        // otra app pidió abrir un PDF con Ozone PDF: se guarda y se avisa a la pantalla
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = _evento {
            if let Some(u) = urls.first() {
                let texto = if u.scheme() == "file" {
                    u.to_file_path().map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| u.to_string())
                } else {
                    u.to_string()
                };
                use tauri::{Emitter, Manager};
                if let Some(p) = _app.try_state::<Pendiente>() {
                    if let Ok(mut x) = p.0.lock() {
                        *x = Some(texto);
                    }
                }
                let _ = _app.emit("archivo-abierto", ());
            }
        }
    });
}

#[cfg(test)]
mod pruebas {
    use super::carpeta_nube;
    #[test]
    fn reconoce_carpetas_de_nube() {
        assert!(carpeta_nube(r"C:\Users\nico\OneDrive\Escritorio\a.pdf".into()).is_some());
        assert!(carpeta_nube(r"C:\Users\nico\OneDrive - Empresa\a.pdf".into()).is_some());
        assert!(carpeta_nube(r"G:\Mi unidad\docs\a.pdf".into()).is_some());
        assert!(carpeta_nube(r"C:\Users\nico\Dropbox\a.pdf".into()).is_some());
        assert!(carpeta_nube("/Users/nico/Library/CloudStorage/GoogleDrive-x/a.pdf".into()).is_some());
        assert!(carpeta_nube("/Users/nico/Library/Mobile Documents/com~apple~CloudDocs/a.pdf".into()).is_some());
        assert!(carpeta_nube(r"C:\Users\nico\Documents\a.pdf".into()).is_none());
        assert!(carpeta_nube(r"D:\Trabajo\Mega proyecto\a.pdf".into()).is_none());
    }
}
