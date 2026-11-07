// Textos de la interfaz en los seis idiomas de Ozone PDF.
export type Idioma = "es" | "en" | "de" | "zh" | "ja" | "ru";
export const IDIOMAS: { id: Idioma; nombre: string }[] = [
  { id: "es", nombre: "Español" },
  { id: "en", nombre: "English" },
  { id: "de", nombre: "Deutsch" },
  { id: "zh", nombre: "中文" },
  { id: "ja", nombre: "日本語" },
  { id: "ru", nombre: "Русский" },
];

type Fila = Record<Exclude<Idioma, "es">, string>;

const TEXTOS: Record<string, Fila> = {
  "Abrir": { en: "Open", de: "Öffnen", zh: "打开", ja: "開く", ru: "Открыть" },
  "Guardar": { en: "Save", de: "Speichern", zh: "保存", ja: "保存", ru: "Сохранить" },
  "Deshacer": { en: "Undo", de: "Rückgängig", zh: "撤销", ja: "元に戻す", ru: "Отменить" },
  "Abrí un PDF para empezar": { en: "Open a PDF to get started", de: "Öffne ein PDF, um loszulegen", zh: "打开一个 PDF 开始", ja: "PDF を開いて始めましょう", ru: "Откройте PDF, чтобы начать" },
  "Arrastralo acá o tocá “Abrir”. Tus archivos nunca salen de tu equipo.": {
    en: "Drag it here or tap “Open”. Your files never leave your device.",
    de: "Zieh es hierher oder tippe auf „Öffnen“. Deine Dateien verlassen nie dein Gerät.",
    zh: "拖到这里或点击“打开”。你的文件永远不会离开你的设备。",
    ja: "ここにドラッグするか「開く」をタップ。ファイルが端末の外に出ることはありません。",
    ru: "Перетащите его сюда или нажмите «Открыть». Ваши файлы никогда не покидают устройство.",
  },
  "Elegir PDF": { en: "Choose PDF", de: "PDF auswählen", zh: "选择 PDF", ja: "PDF を選ぶ", ru: "Выбрать PDF" },
  "Mover": { en: "Move", de: "Verschieben", zh: "移动", ja: "移動", ru: "Перемещать" },
  "Seleccionar": { en: "Select", de: "Auswählen", zh: "选择", ja: "選択", ru: "Выбрать" },
  "Resaltar": { en: "Highlight", de: "Markieren", zh: "高亮", ja: "ハイライト", ru: "Выделить" },
  "Subrayar": { en: "Underline", de: "Unterstreichen", zh: "下划线", ja: "下線", ru: "Подчеркнуть" },
  "Tachar": { en: "Strike out", de: "Durchstreichen", zh: "删除线", ja: "取り消し線", ru: "Зачеркнуть" },
  "Texto": { en: "Text", de: "Text", zh: "文字", ja: "テキスト", ru: "Текст" },
  "Recuadro": { en: "Box", de: "Rahmen", zh: "方框", ja: "四角", ru: "Рамка" },
  "Dibujar": { en: "Draw", de: "Zeichnen", zh: "画笔", ja: "手書き", ru: "Рисовать" },
  "Firmar": { en: "Sign", de: "Unterschreiben", zh: "签名", ja: "署名", ru: "Подписать" },
  "Censurar": { en: "Redact", de: "Schwärzen", zh: "涂黑", ja: "墨消し", ru: "Скрыть" },
  "Borrar": { en: "Delete", de: "Löschen", zh: "删除", ja: "削除", ru: "Удалить" },
  "Color": { en: "Color", de: "Farbe", zh: "颜色", ja: "色", ru: "Цвет" },
  "Acercar": { en: "Zoom in", de: "Vergrößern", zh: "放大", ja: "拡大", ru: "Увеличить" },
  "Alejar": { en: "Zoom out", de: "Verkleinern", zh: "缩小", ja: "縮小", ru: "Уменьшить" },
  "Ajustar al ancho": { en: "Fit width", de: "An Breite anpassen", zh: "适合宽度", ja: "幅に合わせる", ru: "По ширине" },
  "Páginas": { en: "Pages", de: "Seiten", zh: "页面", ja: "ページ", ru: "Страницы" },
  "Página {n} de {total}": { en: "Page {n} of {total}", de: "Seite {n} von {total}", zh: "第 {n} 页，共 {total} 页", ja: "{n} / {total} ページ", ru: "Страница {n} из {total}" },
  "Arrastrá sobre el texto para resaltarlo.": { en: "Drag over the text to highlight it.", de: "Zieh über den Text, um ihn zu markieren.", zh: "在文字上拖动即可高亮。", ja: "テキストの上をドラッグしてハイライト。", ru: "Проведите по тексту, чтобы выделить его." },
  "Arrastrá sobre el texto para subrayarlo.": { en: "Drag over the text to underline it.", de: "Zieh über den Text, um ihn zu unterstreichen.", zh: "在文字上拖动即可加下划线。", ja: "テキストの上をドラッグして下線。", ru: "Проведите по тексту, чтобы подчеркнуть его." },
  "Arrastrá sobre el texto para tacharlo.": { en: "Drag over the text to strike it out.", de: "Zieh über den Text, um ihn durchzustreichen.", zh: "在文字上拖动即可加删除线。", ja: "テキストの上をドラッグして取り消し線。", ru: "Проведите по тексту, чтобы зачеркнуть его." },
  "Tocá donde querés escribir.": { en: "Tap where you want to write.", de: "Tippe dort, wo du schreiben willst.", zh: "点击要输入文字的位置。", ja: "書きたい場所をタップ。", ru: "Нажмите там, где хотите написать." },
  "Arrastrá para dibujar un recuadro.": { en: "Drag to draw a box.", de: "Zieh, um einen Rahmen zu zeichnen.", zh: "拖动以画出方框。", ja: "ドラッグして四角を描きます。", ru: "Потяните, чтобы нарисовать рамку." },
  "Dibujá a mano alzada sobre la página.": { en: "Draw freehand on the page.", de: "Zeichne freihändig auf die Seite.", zh: "在页面上自由绘制。", ja: "ページに自由に描けます。", ru: "Рисуйте на странице от руки." },
  "Tocá donde va la firma.": { en: "Tap where the signature goes.", de: "Tippe dort, wo die Unterschrift hin soll.", zh: "点击签名的位置。", ja: "署名を置く場所をタップ。", ru: "Нажмите, где должна быть подпись." },
  "Marcá lo que querés ocultar. Se borra de verdad al guardar.": {
    en: "Mark what you want to hide. It is truly erased when you save.",
    de: "Markiere, was du verbergen willst. Beim Speichern wird es wirklich gelöscht.",
    zh: "框选要隐藏的内容。保存时会被真正删除。",
    ja: "隠したい部分を囲みます。保存すると完全に消去されます。",
    ru: "Отметьте, что нужно скрыть. При сохранении это удаляется по‑настоящему.",
  },
  "Tocá una anotación para moverla o borrarla.": { en: "Tap an annotation to move or delete it.", de: "Tippe auf eine Anmerkung, um sie zu verschieben oder zu löschen.", zh: "点击批注即可移动或删除。", ja: "注釈をタップして移動・削除。", ru: "Нажмите на пометку, чтобы переместить или удалить её." },
  "Tu firma": { en: "Your signature", de: "Deine Unterschrift", zh: "你的签名", ja: "あなたの署名", ru: "Ваша подпись" },
  "Firmá con el mouse o con el dedo.": { en: "Sign with your mouse or finger.", de: "Unterschreibe mit der Maus oder dem Finger.", zh: "用鼠标或手指签名。", ja: "マウスか指で署名してください。", ru: "Распишитесь мышью или пальцем." },
  "Limpiar": { en: "Clear", de: "Leeren", zh: "清除", ja: "クリア", ru: "Очистить" },
  "Subir imagen": { en: "Upload image", de: "Bild hochladen", zh: "上传图片", ja: "画像を読み込む", ru: "Загрузить изображение" },
  "Usar firma": { en: "Use signature", de: "Unterschrift verwenden", zh: "使用签名", ja: "この署名を使う", ru: "Использовать подпись" },
  "Recordar en este equipo": { en: "Remember on this device", de: "Auf diesem Gerät merken", zh: "在此设备上记住", ja: "この端末に保存", ru: "Запомнить на этом устройстве" },
  "Cancelar": { en: "Cancel", de: "Abbrechen", zh: "取消", ja: "キャンセル", ru: "Отмена" },
  "Aceptar": { en: "OK", de: "OK", zh: "确定", ja: "OK", ru: "ОК" },
  "Listo": { en: "Done", de: "Fertig", zh: "完成", ja: "完了", ru: "Готово" },
  "Cambiar firma": { en: "Change signature", de: "Unterschrift ändern", zh: "更换签名", ja: "署名を変更", ru: "Изменить подпись" },
  "Este PDF tiene contraseña": { en: "This PDF is password protected", de: "Dieses PDF ist passwortgeschützt", zh: "此 PDF 受密码保护", ja: "この PDF はパスワードで保護されています", ru: "Этот PDF защищён паролем" },
  "Contraseña": { en: "Password", de: "Passwort", zh: "密码", ja: "パスワード", ru: "Пароль" },
  "Contraseña incorrecta.": { en: "Wrong password.", de: "Falsches Passwort.", zh: "密码错误。", ja: "パスワードが違います。", ru: "Неверный пароль." },
  "No se pudo abrir el archivo. Verificá que sea un PDF válido.": {
    en: "The file could not be opened. Make sure it is a valid PDF.",
    de: "Die Datei konnte nicht geöffnet werden. Prüfe, ob es ein gültiges PDF ist.",
    zh: "无法打开文件。请确认它是有效的 PDF。",
    ja: "ファイルを開けませんでした。正しい PDF か確認してください。",
    ru: "Не удалось открыть файл. Убедитесь, что это корректный PDF.",
  },
  "No encontré texto en esa zona. Si el PDF es escaneado, usá “Recuadro” o “Dibujar”.": {
    en: "No text found there. If the PDF is scanned, use “Box” or “Draw”.",
    de: "Dort wurde kein Text gefunden. Wenn das PDF gescannt ist, nutze „Rahmen“ oder „Zeichnen“.",
    zh: "该区域没有文字。如果是扫描的 PDF，请使用“方框”或“画笔”。",
    ja: "そこにテキストがありません。スキャンした PDF なら「四角」か「手書き」を使ってください。",
    ru: "Здесь нет текста. Если PDF отсканирован, используйте «Рамка» или «Рисовать».",
  },
  "Censura definitiva": { en: "Permanent redaction", de: "Endgültige Schwärzung", zh: "永久涂黑", ja: "完全な墨消し", ru: "Окончательное скрытие" },
  "Hay {n} zonas marcadas para censurar. Al guardar, el texto, las imágenes y los dibujos que estén debajo se borran del archivo y no se pueden recuperar.": {
    en: "There are {n} areas marked for redaction. When you save, the text, images and drawings underneath are removed from the file and cannot be recovered.",
    de: "Es sind {n} Bereiche zum Schwärzen markiert. Beim Speichern werden Text, Bilder und Zeichnungen darunter aus der Datei entfernt und können nicht wiederhergestellt werden.",
    zh: "有 {n} 个区域被标记为涂黑。保存时，其下方的文字、图片和图形将从文件中删除，且无法恢复。",
    ja: "墨消しの範囲が {n} か所あります。保存すると、その下の文字・画像・図形はファイルから削除され、元に戻せません。",
    ru: "Отмечено областей для скрытия: {n}. При сохранении текст, изображения и рисунки под ними будут удалены из файла без возможности восстановления.",
  },
  "Censurar y guardar": { en: "Redact and save", de: "Schwärzen und speichern", zh: "涂黑并保存", ja: "墨消しして保存", ru: "Скрыть и сохранить" },
  "Guardado ✓": { en: "Saved ✓", de: "Gespeichert ✓", zh: "已保存 ✓", ja: "保存しました ✓", ru: "Сохранено ✓" },
  "No se pudo guardar.": { en: "Could not save.", de: "Speichern fehlgeschlagen.", zh: "无法保存。", ja: "保存できませんでした。", ru: "Не удалось сохранить." },
  "Escribí acá…": { en: "Type here…", de: "Hier schreiben…", zh: "在此输入…", ja: "ここに入力…", ru: "Пишите здесь…" },
  "Tamaño": { en: "Size", de: "Größe", zh: "大小", ja: "サイズ", ru: "Размер" },
  "Idioma": { en: "Language", de: "Sprache", zh: "语言", ja: "言語", ru: "Язык" },
  "Sin conexión · Nada sale de tu equipo": { en: "Offline · Nothing leaves your device", de: "Offline · Nichts verlässt dein Gerät", zh: "离线 · 文件不会离开你的设备", ja: "オフライン · 端末の外には何も送りません", ru: "Офлайн · Ничего не покидает устройство" },
  "Hay cambios sin guardar. ¿Abrir otro archivo igual?": { en: "There are unsaved changes. Open another file anyway?", de: "Es gibt ungespeicherte Änderungen. Trotzdem eine andere Datei öffnen?", zh: "有未保存的更改。仍要打开其他文件吗？", ja: "保存していない変更があります。別のファイルを開きますか？", ru: "Есть несохранённые изменения. Всё равно открыть другой файл?" },
  "¡Hola, soy Labcin! Abrí un PDF y te voy dando tips.": { en: "Hi, I'm Labcin! Open a PDF and I'll give you tips along the way.", de: "Hallo, ich bin Labcin! Öffne ein PDF und ich gebe dir unterwegs Tipps.", zh: "你好，我是 Labcin！打开一个 PDF，我会一路给你提示。", ja: "こんにちは、Labcin です！PDF を開いたら、コツを教えるね。", ru: "Привет, я Лабсин! Откройте PDF, и я буду подсказывать по ходу." },
  "Elegí una herramienta de arriba. Si te equivocás, Ctrl+Z deshace.": { en: "Pick a tool up top. If you make a mistake, Ctrl+Z undoes it.", de: "Wähle oben ein Werkzeug. Bei einem Fehler macht Strg+Z es rückgängig.", zh: "在上方选择一个工具。出错了就按 Ctrl+Z 撤销。", ja: "上のツールを選んでね。まちがえたら Ctrl+Z で元に戻せるよ。", ru: "Выберите инструмент сверху. Ошиблись — Ctrl+Z отменит." },
  "Elegí una herramienta de abajo. Si te equivocás, tocá deshacer.": { en: "Pick a tool below. If you make a mistake, tap undo.", de: "Wähle unten ein Werkzeug. Bei einem Fehler tippe auf Rückgängig.", zh: "在下方选择一个工具。出错了就点撤销。", ja: "下のツールを選んでね。まちがえたら「元に戻す」をタップ。", ru: "Выберите инструмент снизу. Ошиблись — нажмите «Отменить»." },
  "Tocá una anotación para moverla. Con Supr la borrás.": { en: "Tap an annotation to move it. Press Delete to remove it.", de: "Tippe auf eine Anmerkung, um sie zu verschieben. Mit Entf löschst du sie.", zh: "点击批注即可移动，按 Delete 删除。", ja: "注釈をタップすると動かせるよ。Delete キーで削除。", ru: "Нажмите на пометку, чтобы переместить. Delete — удалить." },
  "Arrastrá sobre el texto como si lo seleccionaras. Si no marca nada, puede ser un PDF escaneado.": { en: "Drag over the text as if selecting it. If nothing gets marked, it may be a scanned PDF.", de: "Zieh über den Text, als würdest du ihn auswählen. Wird nichts markiert, ist es vielleicht ein gescanntes PDF.", zh: "像选取文字一样拖过去。如果没有标记，可能是扫描的 PDF。", ja: "文字を選ぶようにドラッグしてね。何も付かないなら、スキャンした PDF かも。", ru: "Проведите по тексту, как при выделении. Если ничего не отмечается, возможно, это скан." },
  "Escribí y tocá afuera para terminar. Ctrl+Enter también sirve.": { en: "Type and tap outside to finish. Ctrl+Enter works too.", de: "Schreib und tippe daneben, um fertig zu werden. Strg+Enter geht auch.", zh: "输入后点击外面即可完成，也可以按 Ctrl+Enter。", ja: "書いたら外側をタップで完了。Ctrl+Enter でも OK。", ru: "Напишите и нажмите рядом, чтобы закончить. Ctrl+Enter тоже работает." },
  "Ideal para destacar una zona. El color lo elegís en la barra.": { en: "Great for highlighting an area. Choose the color in the toolbar.", de: "Ideal, um einen Bereich hervorzuheben. Die Farbe wählst du in der Leiste.", zh: "适合标出一个区域。颜色在工具栏里选。", ja: "範囲を目立たせるのにぴったり。色はツールバーで選べるよ。", ru: "Удобно выделить область. Цвет выбирается на панели." },
  "Perfecto para un círculo o una flecha rápida.": { en: "Perfect for a quick circle or arrow.", de: "Perfekt für einen schnellen Kreis oder Pfeil.", zh: "画个圈或箭头最方便。", ja: "さっと丸や矢印を描くのにぴったり。", ru: "Идеально для быстрого круга или стрелки." },
  "Tu firma queda guardada solo en este equipo. Después de ponerla, la agrandás desde la esquina.": { en: "Your signature is stored only on this device. After placing it, resize it from the corner.", de: "Deine Unterschrift bleibt nur auf diesem Gerät. Nach dem Einfügen kannst du sie an der Ecke vergrößern.", zh: "你的签名只保存在本设备上。放好后可以拖角落调整大小。", ja: "署名はこの端末にだけ保存されるよ。置いたあとは角をドラッグして大きさを変えられる。", ru: "Подпись хранится только на этом устройстве. После вставки размер меняется за уголок." },
  "Ojo: la censura borra de verdad lo que está debajo al guardar. Ideal para DNI, CBU o direcciones.": { en: "Heads up: redaction truly erases what's underneath when you save. Great for ID numbers, bank details or addresses.", de: "Achtung: Schwärzen löscht beim Speichern wirklich, was darunter liegt. Ideal für Ausweisnummern, Kontodaten oder Adressen.", zh: "注意：保存时，涂黑会真正删除下面的内容。适合身份证号、银行账号或地址。", ja: "注意：墨消しは保存すると下の内容を本当に消すよ。身分証番号や口座、住所にぴったり。", ru: "Внимание: при сохранении скрытие действительно удаляет то, что под ним. Подходит для номеров документов, реквизитов и адресов." },
  "¡Listo! Tu PDF quedó guardado.": { en: "Done! Your PDF is saved.", de: "Fertig! Dein PDF ist gespeichert.", zh: "好了！你的 PDF 已保存。", ja: "できた！PDF を保存したよ。", ru: "Готово! PDF сохранён." },
  "Ozone PDF funciona sin internet: tus archivos nunca salen de tu equipo.": { en: "Ozone PDF works offline: your files never leave your device.", de: "Ozone PDF funktioniert offline: Deine Dateien verlassen nie dein Gerät.", zh: "Ozone PDF 无需联网：你的文件永远不会离开设备。", ja: "Ozone PDF はオフラインで動くよ。ファイルが端末の外に出ることはないんだ。", ru: "Ozone PDF работает без интернета: файлы не покидают устройство." },
  "Podés arrastrar un PDF directo a la ventana para abrirlo.": { en: "You can drag a PDF straight into the window to open it.", de: "Du kannst ein PDF direkt ins Fenster ziehen, um es zu öffnen.", zh: "可以直接把 PDF 拖进窗口打开。", ja: "PDF をウィンドウにドラッグするだけで開けるよ。", ru: "PDF можно просто перетащить в окно, чтобы открыть." },
  "Con Ctrl + y Ctrl − hacés zoom.": { en: "Use Ctrl + and Ctrl − to zoom.", de: "Mit Strg + und Strg − zoomst du.", zh: "用 Ctrl + 和 Ctrl − 缩放。", ja: "Ctrl + と Ctrl − でズームできるよ。", ru: "Ctrl + и Ctrl − — масштаб." },
  "Si te sirvió Ozone PDF, podés invitarme un cafecito en pachelabs.net ☕": { en: "If Ozone PDF helped you, you can buy me a coffee at pachelabs.net ☕", de: "Wenn dir Ozone PDF geholfen hat, kannst du mir auf pachelabs.net einen Kaffee spendieren ☕", zh: "如果 Ozone PDF 帮到了你，可以在 pachelabs.net 请我喝杯咖啡 ☕", ja: "Ozone PDF が役に立ったら、pachelabs.net でコーヒーをおごってね ☕", ru: "Если Ozone PDF помог, можно угостить меня кофе на pachelabs.net ☕" },
  "No me toques tanto que me rompo… 🧪": { en: "Don't poke me so much, I might break… 🧪", de: "Nicht so viel antippen, sonst gehe ich kaputt… 🧪", zh: "别一直戳我，我会碎掉的…… 🧪", ja: "そんなにつつかないで、割れちゃう… 🧪", ru: "Не тыкайте так часто, а то разобьюсь… 🧪" },
  "Otro tip": { en: "Another tip", de: "Noch ein Tipp", zh: "再来一个", ja: "ほかのコツ", ru: "Ещё совет" },
  "Ocultar a Labcin": { en: "Hide Labcin", de: "Labcin ausblenden", zh: "隐藏 Labcin", ja: "Labcin をかくす", ru: "Скрыть Лабсина" },
  "Mostrar a Labcin": { en: "Show Labcin", de: "Labcin anzeigen", zh: "显示 Labcin", ja: "Labcin を表示", ru: "Показать Лабсина" },
  "Cerrar": { en: "Close", de: "Schließen", zh: "关闭", ja: "閉じる", ru: "Закрыть" },
  "Herramientas": { en: "Tools", de: "Werkzeuge", zh: "工具", ja: "ツール", ru: "Инструменты" },
};

let actual: Idioma = detectar();

function detectar(): Idioma {
  try {
    const g = localStorage.getItem("ozone.idioma") as Idioma | null;
    if (g && IDIOMAS.some((i) => i.id === g)) return g;
  } catch { /* sin almacenamiento */ }
  const n = (navigator.language || "es").slice(0, 2) as Idioma;
  return IDIOMAS.some((i) => i.id === n) ? n : "en";
}

export function idioma() {
  return actual;
}

export function cambiarIdioma(i: Idioma) {
  actual = i;
  try { localStorage.setItem("ozone.idioma", i); } catch { /* nada */ }
  document.documentElement.lang = i;
}

export function T(es: string, datos?: Record<string, string | number>) {
  let s = actual === "es" ? es : TEXTOS[es]?.[actual] ?? es;
  if (datos) for (const [k, v] of Object.entries(datos)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
