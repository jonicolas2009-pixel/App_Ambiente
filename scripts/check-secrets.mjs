// Revisa el código antes de publicar: falla si encuentra una clave secreta de Supabase.
// Uso: node scripts/check-secrets.mjs   (también corre automáticamente en GitHub Actions)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.git']);
const EXT = new Set(['.js', '.mjs', '.html', '.json', '.md', '.sql', '.yml', '.yaml', '.txt', '.env']);
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (EXT.has(extname(name)) || name.startsWith('.env')) check(p);
  }
}

function check(file) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/sb_secret_[A-Za-z0-9_-]{10,}/g)) problems.push(`${file}: clave secreta sb_secret_… encontrada`);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') problems.push(`${file}: JWT con role "service_role" encontrado`);
    } catch { /* no es un JWT válido */ }
  }
  for (const m of text.matchAll(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@/g)) problems.push(`${file}: cadena de conexión con contraseña encontrada`);
}

walk(ROOT);
if (problems.length) {
  console.error('❌ Se encontraron secretos. No publiques este código:\n' + problems.join('\n'));
  console.error('\nQué hacer: borra la clave del archivo, y en Supabase → Settings → API Keys genera una nueva (la vieja ya debe considerarse comprometida).');
  process.exit(1);
}
console.log('✅ Sin claves secretas en el código.');
