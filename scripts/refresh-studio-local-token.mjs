// First pull Development only:
// pnpm dlx vercel@65.16.0 env pull .env.studio-oidc.local --environment=development --project=prj_otqxek2aZ9ROmGzdC6fQqBgLdhvI --scope=love-strings-dashboard --yes
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const pulled = parseEnv(await readFile('.env.studio-oidc.local', 'utf8'));
const token = pulled.VERCEL_OIDC_TOKEN;
if (!token) throw new Error('Pull the Development environment first; no local OIDC token was found.');
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
if (claims.iss !== 'https://oidc.vercel.com' || claims.sub !== 'owner:love-strings-dashboard:project:love-strings-dashboard:environment:development' || !Number.isFinite(claims.exp) || claims.exp * 1000 < Date.now() + 60000) throw new Error('Pull a fresh ArtistDeck Development OIDC token.');
const current = await readFile('.env.local', 'utf8');
const lines = current.split('\n').filter((line) => !/^VERCEL_OIDC_TOKEN\s*=/.test(line));
await writeFile('.env.local', `${lines.join('\n').trimEnd()}\nVERCEL_OIDC_TOKEN=${JSON.stringify(token)}\n`, { mode: 0o600 });
await chmod('.env.local', 0o600);
await chmod('.env.studio-oidc.local', 0o600);
console.log(`Local development token refreshed; expires ${new Date(claims.exp * 1000).toISOString()}. No other environment values were imported.`);
