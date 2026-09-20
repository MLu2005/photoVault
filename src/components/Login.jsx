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
    <section className="login-story"><a className="brand" href="/"><span className="brand-mark"><Icon name="vault" size={25}/></span><span>photo<span className="brand-light">vault</span><small>NASZA PRZESTRZEŃ</small></span></a>
      <div className="story-copy"><span className="eyebrow">TYLKO DLA WAS</span><h1>{'Małe chwile.'}<br/>{'Wspólna historia.'}</h1><p>{'Weekend bez planu. Film z wakacji. To jedno zdjęcie, do którego zawsze wracacie. Wszystko w jednym miejscu.'}</p></div>
      <div className="story-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card art-card-back"><Icon name="film" size={42}/><span>Nasze momenty</span></div><div className="art-card art-card-front"><div className="art-landscape"><div className="art-sun"/><div className="art-hill hill-one"/><div className="art-hill hill-two"/></div><div className="art-caption"><Icon name="heart" size={18}/><span>{'Dobrze być razem.'}</span></div></div><span className="art-note"><Icon name="lock" size={14}/> {'Prywatnie. Po Waszemu.'}</span></div>
      <div className="story-footer"><span className="status-dot"/> {'Zdjęcia i filmy, nie kolejny feed.'}</div>
    </section>
    <main className="login-form-area"><div className="login-top"><span><Icon name="lock" size={15}/> Prywatna biblioteka</span></div>
      <form className="login-form" onSubmit={submit}><span className="form-emblem"><Icon name="vault" size={30}/></span><span className="eyebrow">WITAJCIE W DOMU</span><h2>{'Wasze miejsce na wspomnienia.'}</h2><p className="muted">{'Zaloguj się, by wrócić do dobrych chwil.'}</p>
        <label htmlFor="username">{'Nazwa użytkownika'}</label><input id="username" name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="Twoja nazwa" maxLength={40} required disabled={busy}/>
        <label htmlFor="password">{'Hasło'}</label><div className="password-field"><input id="password" name="password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" maxLength={256} required disabled={busy}/><IconButton icon="eye" label={show ? 'Ukryj hasło' : 'Pokaż hasło'} aria-pressed={show} onClick={() => setShow(!show)}/></div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="button primary login-submit" disabled={busy}>{busy ? <><span className="spinner"/>Logowanie...</> : <>{'Otwórz bibliotekę'}<Icon name="arrow"/></>}</button>
        <p className="login-help"><Icon name="info" size={16}/><span>{'Nie pamiętasz hasła? Właściciel aplikacji może ustawić nowe w konfiguracji kont.'}</span></p>
      </form><footer className="login-footer">photoVault <span>&middot;</span> {'Prywatna przestrzeń dla Was dwojga'}</footer>
    </main>
  </div>;
}
