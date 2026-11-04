import * as fs from 'node:fs';
import { createClient } from '/workspaces/Robotics-Interview-Dashboard/artifacts/api-server/node_modules/@supabase/supabase-js/dist/index.mjs';

const envText = fs.readFileSync('/workspaces/Robotics-Interview-Dashboard/.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const primaryUrl = env.SUPABASE_URL;
const primaryKey = env.SUPABASE_SERVICE_ROLE_KEY;
const secondaryUrl = env.SECONDARY_SUPABASE_URL;
const secondaryKey = env.SECONDARY_SUPABASE_SECRET_KEY;
const bucket = env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
const secBucket = env.SECONDARY_SUPABASE_STORAGE_BUCKET || bucket;

const primary = createClient(primaryUrl, primaryKey, { auth: { persistSession: false } });
const secondary = createClient(secondaryUrl, secondaryKey, { auth: { persistSession: false } });

async function listAll(client, bucket, prefix = '', results = []) {
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset: results.length });
  if (error) throw new Error(`list ${prefix}: ${error.message}`);
  if (!data || data.length === 0) return results;
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null && !item.metadata) {
      await listAll(client, bucket, path, results);
    } else {
      results.push(path);
    }
  }
  return results;
}

async function main() {
  console.log('listing primary...');
  const primaryFiles = await listAll(primary, bucket, '');
  console.log(`primary files: ${primaryFiles.length}`);
  console.log('listing secondary...');
  const secondaryFiles = await listAll(secondary, secBucket, '');
  console.log(`secondary files: ${secondaryFiles.length}`);
  const existing = new Set(secondaryFiles);
  const missing = primaryFiles.filter(f => !existing.has(f));
  console.log(`to copy: ${missing.length}`);

  let copied = 0, failed = 0;
  for (const path of missing) {
    try {
      const { data, error: dlErr } = await primary.storage.from(bucket).download(path);
      if (dlErr) throw new Error(dlErr.message);
      const buf = Buffer.from(await data.arrayBuffer());
      const contentType = data.type || undefined;
      const { error: upErr } = await secondary.storage.from(secBucket).upload(path, buf, { upsert: true, contentType });
      if (upErr) throw new Error(upErr.message);
      copied++;
      if (copied % 10 === 0) console.log(`copied ${copied}/${missing.length} ${path}`);
    } catch (e) {
      failed++;
      console.error(`FAILED ${path}: ${e.message}`);
    }
  }
  console.log(`done copied=${copied} failed=${failed}`);
  const finalFiles = await listAll(secondary, secBucket, '');
  console.log(`secondary final: ${finalFiles.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
