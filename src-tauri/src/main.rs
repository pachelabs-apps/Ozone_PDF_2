// En Windows, evita que se abra una consola junto con la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ozone_pdf_lib::run()
}
