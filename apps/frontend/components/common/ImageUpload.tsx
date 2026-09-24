'use client';

import { useRef, useState } from 'react';
import { uploadImage, type UploadFolder } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface ImageUploadProps {
  label: string;
  value: string;
  folder: UploadFolder;
  onChange: (url: string) => void;
  /** Recorte cuadrado centrado (fotos de socios). */
  square?: boolean;
  /** Lado máximo en píxeles antes de subir. */
  maxSize?: number;
  hint?: string;
}

/**
 * Achica (y opcionalmente recorta) la imagen en el navegador antes de subirla:
 * una foto de celular de 5 MB viaja como un JPG de ~150 KB. El servidor la
 * vuelve a validar y la guarda como WEBP sin metadatos.
 */
async function prepareImage(file: File, square: boolean, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite procesar la imagen');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG si puede tener transparencia (logos), JPG para fotos
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      type,
      0.85,
    ),
  );
}

export function ImageUpload({
  label,
  value,
  folder,
  onChange,
  square = false,
  maxSize = 1600,
  hint,
}: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Elegí un archivo de imagen (JPG, PNG o WEBP)');
      return;
    }
    setBusy(true);
    try {
      const blob = await prepareImage(file, square, maxSize);
      const { url } = await uploadImage(blob, folder, file.name);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-gray-200 bg-gray-50 ${
            square ? 'rounded-full' : 'rounded-xl'
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-gray-400">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? 'Subiendo...' : value ? 'Cambiar' : 'Subir imagen'}
          </Button>
          {value && !busy && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
