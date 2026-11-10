package net.pachelabs.ozonepdf

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kotlin.math.roundToInt

// La app ocupa toda la pantalla, también detrás de la barra de estado y de los botones del sistema.
// El WebView de Android no le avisa a la página cuánto miden esas barras (solo el "notch"),
// así que se lo pasamos nosotros: la página lo lee con window.OzoneBordes y lo usa en el CSS.
// Si el usuario gira el celular y los botones quedan al costado, se corre la vista hacia adentro.
class MainActivity : TauriActivity() {
  @Volatile private var arriba = 0
  @Volatile private var abajo = 0
  private var vista: WebView? = null

  inner class Bordes {
    @JavascriptInterface fun arriba(): Int = this@MainActivity.arriba
    @JavascriptInterface fun abajo(): Int = this@MainActivity.abajo
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    vista = webView
    webView.addJavascriptInterface(Bordes(), "OzoneBordes")
    ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
      val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val d = resources.displayMetrics.density
      arriba = (b.top / d).roundToInt()
      abajo = (b.bottom / d).roundToInt()
      v.setPadding(b.left, 0, b.right, 0)
      (v as WebView).evaluateJavascript("window.dispatchEvent(new Event('ozone-bordes'))", null)
      insets
    }
    ViewCompat.requestApplyInsets(webView)
  }
}
