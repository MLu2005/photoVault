import React, { useState } from 'react';
import Icon, { IconButton } from './Icon.jsx';
import { bytes } from '../lib/format.js';
export default function UploadPanel({ jobs, queue }) {
  const [expanded, setExpanded] = useState(true);
  if (!jobs.length) return null;
  const active = jobs.filter(j => ['queued','uploading'].includes(j.status));
  const complete = jobs.filter(j => j.status === 'done').length, failed = jobs.filter(j => j.status === 'error').length;
  const total = jobs.reduce((a,j) => a + j.size, 0), loaded = jobs.reduce((a,j) => a + Math.min(j.loaded, j.size), 0);
  return <section className="upload-panel" aria-label="Upload queue">
    <header><button className="upload-panel-heading" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><span className={`upload-panel-icon ${active.length ? 'active' : ''}`}><Icon name={active.length ? 'upload' : failed ? 'info' : 'check'} size={18}/></span><span><strong>{active.length ? 'Uploading files' : failed ? 'Check uploads' : 'Queue complete'}</strong><small>{complete} of {jobs.length} saved{failed ? ` · ${failed} failed` : ''}</small></span><Icon name={expanded ? 'down' : 'plus'} size={16}/></button>
      {!active.length && <IconButton icon="x" label="Clear finished" onClick={() => queue.clearFinished()}/>}</header>
    {active.length > 0 && <div className="total-progress"><progress value={loaded} max={total || 1}/><span>{bytes(loaded)} / {bytes(total)}</span></div>}
    {expanded && <><div className="upload-jobs">{jobs.map(job => <div className="upload-job" key={job.id}><span className={`job-state ${job.status}`}><Icon name={job.status === 'done' ? 'check' : job.status === 'error' ? 'info' : job.type.startsWith('video/') ? 'film' : 'photo'} size={18}/></span><div className="job-copy"><strong title={job.name}>{job.name}</strong><small>{job.status === 'done' ? `Saved · ${job.album}` : job.status === 'queued' ? 'Queued' : job.status === 'uploading' ? `${job.stage} · ${Math.min(100, Math.round(job.loaded / job.size * 100))}%` : job.error}</small>{job.status === 'uploading' && <progress value={job.loaded} max={job.size}/>}</div>
      {['queued','uploading'].includes(job.status) ? <IconButton icon="x" label={`Cancel: ${job.name}`} onClick={() => queue.cancel(job.id)}/> : ['error','cancelled'].includes(job.status) ? <IconButton icon="refresh" label={`Retry: ${job.name}`} onClick={() => queue.retry(job.id)}/> : null}</div>)}</div>
      <footer><span>{'You can continue browsing the library.'}</span>{active.length > 0 && <button onClick={() => queue.cancelAll()} className="text-button">Cancel all</button>}{!active.length && <button onClick={() => queue.clearFinished()} className="text-button">{'Clear finished'}</button>}</footer></>}
  </section>;
}
