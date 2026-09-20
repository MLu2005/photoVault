#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { hashPassword } = require('../api/shared/auth');
const root = path.resolve(__dirname, '..');
function ask(prompt) {
  return new Promise(resolve => { const rl = readline.createInterface({ input:process.stdin, output:process.stdout }); rl.question(prompt, answer => { rl.close(); resolve(answer.trim()); }); });
}
function password(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt); readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
    let value = '';
    const cleanup = () => { process.stdin.off('keypress', keypress); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const keypress = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Przerwano.')); return; }
      if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(value); return; }
      if (key.name === 'backspace') { if (value) { value = [...value].slice(0,-1).join(''); process.stdout.write('\b \b'); } return; }
      if (!key.ctrl && !key.meta && str && !/[\u0000-\u001f\u007f]/.test(str) && value.length + str.length <= 256) { value += str; process.stdout.write('*'.repeat([...str].length)); }
    };
    process.stdin.on('keypress', keypress);
  });
}
async function main() {
  if (!process.stdin.isTTY) throw new Error('Uruchom ten skrypt w zwyklym terminalu. Hasla nie sa przyjmowane jako argumenty polecenia.');
  const destination = path.join(root, '.photovault-secrets.json');
  if (fs.existsSync(destination) && (await ask('Konfiguracja juz istnieje. Zastapic i uniewaznic sesje? Wpisz TAK: ')) !== 'TAK') return;
  console.log('\nPhotoVault - konfiguracja dwoch prywatnych kont\nHasla sa maskowane; w pliku znajda sie tylko hashe.\n');
  const users = [];
  for (let i = 0; i < 2; i++) {
    const username = (await ask(`Konto ${i + 1} - nazwa uzytkownika (3-40 znakow a-z, cyfry, . _ -): `)).toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || users.some(u => u.username === username)) throw new Error('Niepoprawna lub powtorzona nazwa uzytkownika.');
    const displayName = await ask('Imie wyswietlane w aplikacji: ');
    if (displayName.length > 60) throw new Error('Imie jest zbyt dlugie (maks. 60 znakow).');
    const pass = await password('Haslo (min. 14 znakow; najlepiej kilka slow): ');
    if (pass.length < 14 || pass.length > 256) throw new Error('Haslo musi miec od 14 do 256 znakow.');
    if (pass !== await password('Powtorz haslo: ')) throw new Error('Hasla nie sa takie same.');
    users.push({ username, displayName:displayName || username, passwordHash:await hashPassword(pass) });
  }
  let origin = (await ask('\nAdres aplikacji w Azure, np. https://twoja-aplikacja.azurestaticapps.net: ')).replace(/\/$/, '');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || origin !== url.origin) throw new Error('Podaj sam adres HTTPS aplikacji, bez sciezki.');
  const settings = { PV_APP_ORIGIN:origin, PV_SESSION_SECRET:crypto.randomBytes(48).toString('base64url'), PV_USERS:JSON.stringify(users), PV_MAX_UPLOAD_MB:'1024', PV_SESSION_DAYS:'7' };
  fs.writeFileSync(destination, JSON.stringify(settings, null, 2) + '\n', { mode:0o600 });
  const localPath = path.join(root,'api','local.settings.json');
  let local = JSON.parse(fs.readFileSync(fs.existsSync(localPath) ? localPath : path.join(root,'api','local.settings.example.json'), 'utf8'));
  local.Values = { ...local.Values, ...settings, PV_APP_ORIGIN:'http://127.0.0.1:5173', PV_DEV_HTTP:'true' };
  fs.writeFileSync(localPath, JSON.stringify(local,null,2) + '\n', { mode:0o600 });
  console.log('\nGotowe. Otworz .photovault-secrets.json i skopiuj WARTOSCI do Environment variables w Azure Static Web App.');
  console.log('Nie publikuj tego pliku. Nie kopiuj PV_DEV_HTTP do Azure. Istniejace klucze Storage pozostaja bez zmian.');
  console.log('Plik api/local.settings.json przygotowano do lokalnej pracy. Uzupelnij w nim swoje klucze Storage.');
}
main().catch(error => { console.error(`\n${error.message}`); process.exitCode = 1; });
