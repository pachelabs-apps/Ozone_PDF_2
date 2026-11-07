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
