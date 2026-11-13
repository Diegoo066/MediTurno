import crypto from 'node:crypto';
process.stdout.write('Contraseña administrativa (no se mostrará): ');
process.stdin.setRawMode?.(true);
process.stdin.resume();
let password = '';
process.stdin.on('data', chunk => {
  for (const byte of chunk) {
    if (byte === 3) { process.stdout.write('\n'); process.exit(130); }
    if (byte === 13 || byte === 10) {
      process.stdin.setRawMode?.(false); process.stdin.pause(); process.stdout.write('\n'); createHash(password); return;
    }
    if (byte === 8 || byte === 127) { password = password.slice(0, -1); continue; }
    password += String.fromCharCode(byte);
  }
});

function createHash(password) {
  if (!password) { console.error('La contraseña no puede estar vacía.'); process.exitCode = 1; return; }
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  console.log(`scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`);
}
