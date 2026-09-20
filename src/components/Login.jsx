import React, { useState } from 'react';
import Icon, { IconButton } from './Icon.jsx';
import { api } from '../lib/api.js';
export default function Login({ onLogin, initialError = '' }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(initialError), [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { onLogin(await api('authLogin', { method:'POST', body:{ username, password } })); setPassword(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="login-page">
    <section className="login-story"><a className="brand" href="/"><span className="brand-mark"><Icon name="vault" size={25}/></span><span>photo<span className="brand-light">vault</span><small>OUR SPACE</small></span></a>
      <div className="story-copy"><span className="eyebrow">JUST FOR YOU TWO</span><h1>{'Little moments.'}<br/>{'Our story.'}</h1><p>{'A weekend with no plan. A holiday video. That one photo you always come back to. Everything in one place.'}</p></div>
      <div className="story-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card art-card-back"><Icon name="film" size={42}/><span>Our moments</span></div><div className="art-card art-card-front"><div className="art-landscape"><div className="art-sun"/><div className="art-hill hill-one"/><div className="art-hill hill-two"/></div><div className="art-caption"><Icon name="heart" size={18}/><span>{'Better together.'}</span></div></div><span className="art-note"><Icon name="lock" size={14}/> {'Private. Your way.'}</span></div>
      <div className="story-footer"><span className="status-dot"/> {'Photos and videos, not another feed.'}</div>
    </section>
    <main className="login-form-area"><div className="login-top"><span><Icon name="lock" size={15}/> Private library</span></div>
      <form className="login-form" onSubmit={submit}><span className="form-emblem"><Icon name="vault" size={30}/></span><span className="eyebrow">WELCOME HOME</span><h2>{'Your place for memories.'}</h2><p className="muted">{'Sign in to get back to the good moments.'}</p>
        <label htmlFor="username">{'Username'}</label><input id="username" name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="Your username" maxLength={40} required disabled={busy}/>
        <label htmlFor="password">{'Password'}</label><div className="password-field"><input id="password" name="password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" maxLength={256} required disabled={busy}/><IconButton icon="eye" label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}/></div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="button primary login-submit" disabled={busy}>{busy ? <><span className="spinner"/>Signing in...</> : <>{'Open library'}<Icon name="arrow"/></>}</button>
        <p className="login-help"><Icon name="info" size={16}/><span>{'Forgot your password? The app owner can set a new one in the account configuration.'}</span></p>
      </form><footer className="login-footer">photoVault <span>&middot;</span> {'A private space for the two of you'}</footer>
    </main>
  </div>;
}
