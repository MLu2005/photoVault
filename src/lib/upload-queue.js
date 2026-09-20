import { api } from './api.js';
import { MIME } from './format.js';
import { uploadBlob } from './upload.js';
import { thumbnail } from './thumbnail.js';
export class UploadQueue {
  constructor({ concurrency = 3, maxBytes = 1024 ** 3, onSettled = () => {}, transport = { api, uploadBlob, thumbnail } } = {}) {
    this.concurrency = concurrency; this.maxBytes = maxBytes; this.onSettled = onSettled; this.transport = transport;
    this.jobs = []; this.listeners = new Set(); this.active = 0; this.disposed = false;
  }
  subscribe(fn) { this.listeners.add(fn); fn(this.snapshot()); return () => this.listeners.delete(fn); }
  snapshot() { return this.jobs.map(({ file, controller, ...job }) => ({ ...job })); }
  emit() { const data = this.snapshot(); this.listeners.forEach(fn => fn(data)); }
  add(files, album) {
    let added = 0; const errors = [];
    for (const file of files) {
      const type = MIME[file.name.split('.').pop().toLowerCase()];
      if (!type || file.size <= 0 || file.size > this.maxBytes || file.name.length > 200 || file.name.startsWith('.')) { errors.push(file.name); continue; }
      const key = `${album}|${file.name}|${file.size}|${file.lastModified}`;
      if (this.jobs.some(j => j.key === key)) continue;
      if (this.jobs.length >= 500) { errors.push(file.name); continue; }
      this.jobs.push({ id:crypto.randomUUID(), key, album, name:file.name, size:file.size, type, file,
        status:'queued', loaded:0, error:null, originalUploaded:false, ticket:null }); added++;
    }
    this.emit(); this.pump(); return { added, errors };
  }
  pump() {
    if (this.disposed) return;
    while (this.active < this.concurrency) {
      const job = this.jobs.find(j => j.status === 'queued'); if (!job) break;
      job.status = 'uploading'; this.active++; job.controller = new AbortController(); this.emit();
      this.run(job).finally(() => { this.active--; job.controller = null; this.emit(); if (!this.disposed) this.onSettled(); this.pump(); });
    }
  }
  async run(job) {
    const signal = job.controller.signal;
    try {
      const { api, uploadBlob, thumbnail } = this.transport;
      job.stage = 'Przygotowanie'; this.emit();
      job.ticket = await api('getUploadUrl', { method:'POST', body:{ event:job.album, filename:job.name, size:job.size, uploadId:job.id }, signal });
      if (!job.originalUploaded) {
        job.stage = 'Przesyłanie'; this.emit();
        await uploadBlob(job.ticket.uploadUrl, job.file, { contentType:job.type, signal, onProgress:n => { job.loaded = n; this.emit(); } });
        job.originalUploaded = true;
      }
      job.stage = 'Zapisywanie podglądu'; this.emit();
      let hasThumbnail = false;
      try {
        const preview = await thumbnail(job.file, job.type, signal);
        if (preview && !signal.aborted) {
          await uploadBlob(job.ticket.thumbnailUploadUrl, preview, { contentType:'image/jpeg', signal }); hasThumbnail = true;
        }
      } catch (error) { if (error.name === 'AbortError') throw error; /* Original remains usable without a thumbnail. */ }
      job.stage = 'Finalizowanie'; this.emit();
      await api('completeUpload', { method:'POST', body:{ blobName:job.ticket.blobName, thumbnail:hasThumbnail }, signal });
      job.status = 'done'; job.loaded = job.size; job.file = null; job.ticket = null;
    } catch (error) {
      job.status = signal.aborted || error.name === 'AbortError' ? 'cancelled' : 'error';
      job.error = job.status === 'cancelled' ? (job.originalUploaded ? 'Oryginał został już zapisany; anulowano finalizowanie.' : 'Przesyłanie anulowane.') : error.message;
    }
  }
  cancel(id) {
    const job = this.jobs.find(j => j.id === id); if (!job) return;
    if (job.controller) job.controller.abort(); else if (job.status === 'queued') { job.status = 'cancelled'; job.error = 'Przesyłanie anulowane.'; }
    this.emit();
  }
  cancelAll() { this.jobs.forEach(job => this.cancel(job.id)); }
  retry(id) {
    const job = this.jobs.find(j => j.id === id);
    if (job && ['error','cancelled'].includes(job.status) && !job.controller) { job.status = 'queued'; job.error = null; if (!job.originalUploaded) job.loaded = 0; this.emit(); this.pump(); }
  }
  clearFinished() { this.jobs = this.jobs.filter(j => !['done','cancelled'].includes(j.status) || j.controller); this.emit(); }
  dispose() { this.disposed = true; this.cancelAll(); this.listeners.clear(); }
}
