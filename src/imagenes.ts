// Deja una imagen lista para ponerla en un PDF:
// - las fotos del celular guardan "esta foto va girada" en sus datos (EXIF); el motor de PDF no lo lee,
//   así que se gira acá para que no queden acostadas;
// - los formatos que el motor no entiende (WebP, AVIF) se pasan a PNG.
// Todo pasa en la computadora: se usa el decodificador del propio navegador de la app.

function esJpeg(b: Uint8Array) { return b[0] === 0xff && b[1] === 0xd8; }
function esWebp(b: Uint8Array) {
  return b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
}
function esAvif(b: Uint8Array) {
  return b.length > 12 && String.fromCharCode(...b.slice(4, 12)) === "ftypavif";
}

// Lee la orientación EXIF (1 = derecha) de un JPEG. Si no hay dato, devuelve 1.
export function orientacionExif(b: Uint8Array): number {
  if (!esJpeg(b)) return 1;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 2;
  while (o + 4 < b.length) {
    if (b[o] !== 0xff) return 1;
    const marca = b[o + 1], largo = v.getUint16(o + 2);
    if (marca === 0xe1 && v.getUint32(o + 4) === 0x45786966) { // "Exif"
      const t = o + 10;
      const le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le);
      const n = v.getUint16(ifd, le);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > b.length) return 1;
        if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le) || 1;
      }
      return 1;
    }
    if (marca === 0xda) return 1; // empezó la imagen: no hay EXIF
    o += 2 + largo;
  }
  return 1;
}

export async function prepararImagen(b: Uint8Array): Promise<Uint8Array> {
  const girada = orientacionExif(b) > 1;
  const convertir = esWebp(b) || esAvif(b);
  if (!girada && !convertir) return b;
  const bmp = await createImageBitmap(new Blob([b as BlobPart]), { imageOrientation: "from-image" });
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  const tipo = convertir ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((ok, mal) => c.toBlob((x) => (x ? ok(x) : mal(new Error("IMAGEN"))), tipo, 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}
