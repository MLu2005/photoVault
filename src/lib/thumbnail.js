function canvasBlob(source, width, height) {
  const scale = Math.min(1, 720 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d'); if (!context) return Promise.resolve(null);
  context.fillStyle = '#eeeae4'; context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(source,0,0,canvas.width,canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
}
export async function thumbnail(file, type, signal) {
  // Preview generation is best-effort and never changes the original file.
  if (signal?.aborted) return null;
  if (type.startsWith('image/') && file.size <= 40 * 1024 * 1024 && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation:'from-image' });
      try { return signal?.aborted ? null : await canvasBlob(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
    } catch { return null; }
  }
  if (!type.startsWith('video/')) return null;
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), video = document.createElement('video');
    let finished = false;
    const done = result => {
      if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      video.onloadedmetadata = video.onseeked = video.onerror = null; video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(result);
    };
    const cancel = () => done(null), timer = setTimeout(cancel, 8000);
    signal?.addEventListener('abort', cancel, { once:true });
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, Number.isFinite(video.duration) ? Math.max(0.01, video.duration / 3) : 0.5); };
    video.onseeked = async () => {
      if (finished) return;
      try { done(await canvasBlob(video, video.videoWidth, video.videoHeight)); } catch { done(null); }
    };
    video.onerror = cancel; video.src = url;
  });
}
