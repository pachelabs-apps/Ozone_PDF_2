package net.pachelabs.ozonepdf

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlin.math.roundToInt

// La app ocupa toda la pantalla, también detrás de la barra de estado y de los botones del sistema.
// El WebView de Android no le avisa a la página cuánto miden esas barras (solo el "notch"),
// así que se lo pasamos nosotros en window.__ozoneBordes (en dp, que equivalen a px de CSS).
// Se inyecta al empezar cada carga de página y además se repite unas veces por si la página
// terminó de cargar después del primer aviso.
class MainActivity : TauriActivity() {
  private var vista: WebView? = null
  private var guion: ScriptHandler? = null
  private var ultimo = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    vista = webView
    val raiz = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(raiz) { v, insets ->
      avisar(insets, false)
      ViewCompat.onApplyWindowInsets(v, insets)
    }
    ViewCompat.requestApplyInsets(raiz)
    for (ms in longArrayOf(0, 700, 2000, 5000)) {
      webView.postDelayed({ ViewCompat.getRootWindowInsets(webView)?.let { avisar(it, true) } }, ms)
    }
  }

  private fun avisar(insets: WindowInsetsCompat, forzar: Boolean) {
    val w = vista ?: return
    val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
    val d = resources.displayMetrics.density
    val js = "window.__ozoneBordes={arriba:${(b.top / d).roundToInt()},abajo:${(b.bottom / d).roundToInt()}};" +
      "window.dispatchEvent(new Event('ozone-bordes'));"
    if (js == ultimo && !forzar) return
    if (js != ultimo && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      guion?.remove()
      guion = WebViewCompat.addDocumentStartJavaScript(w, js, setOf("*"))
    }
    ultimo = js
    w.evaluateJavascript(js, null)
  }
}
