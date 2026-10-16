import { readdir, lstat, readFile, writeFile, rename, unlink, mkdir, access } from 'node:fs/promises';
import { resolve, relative, sep, join } from 'node:path';
import { privateBackupDirectory, encryptPrivateBackup, decryptPrivateBackup, privateBackupMetadata, privateBackupFileHash,encryptLargePrivateBackup } from '../src/application/migration/private-offline-backup.js';

// Explicit operator command; never invoked by the backend against the live game.
// The encrypted local PG rehearsal is retired as a runnable clone. Its independent
// R1099 recovery archive remains encrypted with its original DPAPI key until expiry.
const mode=process.argv[2];
if(!['inventory','seal','sweep'].includes(mode??''))throw new Error('PRIVATE_BACKUP_MODE_REQUIRED');
const vault=privateBackupDirectory(),root=resolve(vault,'..');
const excluded=new Set(['node_modules','.git','pg-npm','private-backups','character-assets','dist','assets','public','candidate','baseline','worktrees']);
type Entry={path:string;capturedAt:string;expiresAt:string;cipherHash:string};
type Policy={version:1;maximumDays:30;files:Entry[]};
const policyFile=join(vault,'policy.json');
async function safe(file:string) {
  const resolved=resolve(root,file);
  if(!resolved.startsWith(root+sep))throw new Error('PRIVATE_BACKUP_PATH_OUTSIDE_ROOT');
  for(let current=resolved;current!==root;current=resolve(current,'..')){
    const stat=await lstat(current);if(stat.isSymbolicLink())throw new Error('PRIVATE_BACKUP_LINK_REFUSED');
  }
  if(!(await lstat(resolved)).isFile())throw new Error('PRIVATE_BACKUP_FILE_REQUIRED');
  return resolved;
}
async function candidates(directory=root):Promise<string[]> {
  // Historical QA checkouts contain source/catalog assets, not operator backups.
  if(directory!==root) {
    try{await access(join(directory,'package.json'));return [];}catch{/* Not a code checkout. */}
    try{await access(join(directory,'.git'));return [];}catch{/* Not a worktree. */}
  }
  const result:string[]=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    if(excluded.has(entry.name)||entry.name.startsWith('r1100'))continue;
    if(entry.isSymbolicLink())continue; // Never follow links, including historical QA worktree dependencies.
    const file=join(directory,entry.name);
    if(entry.isDirectory())result.push(...await candidates(file));
    else if(entry.isFile()&&(relative(root,file).split(sep).includes('pg-data')||/\.(?:json|jsonl|log|txt|csv|tsv|dump|sql|gienc|dpapi|png|jpe?g|webp)$/i.test(entry.name)))result.push(file);
  }
  return result;
}
await mkdir(vault,{recursive:true});
if(mode==='sweep') {
  let policy:Policy;
  try{policy=JSON.parse(await readFile(policyFile,'utf8')) as Policy;}
  catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT')policy={version:1,maximumDays:30,files:[]};else throw error;}
  if(policy.version!==1||policy.maximumDays!==30||!Array.isArray(policy.files))throw new Error('PRIVATE_BACKUP_POLICY_INVALID');
  // Also discover newly written envelopes and copies left by an interrupted seal.
  const known=new Set(policy.files.map(entry=>entry.path));
  for(const file of await candidates()) {
    const path=relative(root,file);if(known.has(path))continue;
    const metadata=await privateBackupMetadata(await safe(path));if(!metadata)continue;
    if(Date.parse(metadata.expiresAt)-Date.parse(metadata.capturedAt)!==30*86400000)throw new Error('PRIVATE_BACKUP_DATE_INVALID');
    policy.files.push({path,...metadataOnly(metadata),cipherHash:await privateBackupFileHash(file)});
  }
  const kept:Entry[]=[];let erased=0;
  for(const entry of policy.files) {
    // One-day reserve for the daily physical cleanup; reader expiry remains
    // strict even while this Windows machine is offline.
    if(Date.now()<Date.parse(entry.expiresAt)-86400000){kept.push(entry);continue;}
    let file:string;
    try{file=await safe(entry.path);}catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT')continue;throw error;}
    const metadata=await privateBackupMetadata(file);
    if(!metadata||metadata.expiresAt!==entry.expiresAt||metadata.capturedAt!==entry.capturedAt||await privateBackupFileHash(file)!==entry.cipherHash)throw new Error('PRIVATE_BACKUP_CHANGED_REFUSE_ERASURE');
    await unlink(file);erased++;
  }
  await writeFile(policyFile,JSON.stringify({...policy,files:kept}),{mode:0o600});
  console.log(JSON.stringify({mode,erased,remaining:kept.length,maximumDays:30}));
} else {
  const files=await candidates();let bytesTotal=0;const entries:Entry[]=[];const sizes:Record<string,number>={};
  for(const candidate of files) {
    const file=await safe(relative(root,candidate)),stat=await lstat(file);bytesTotal+=stat.size;
    const category=relative(root,file).split(sep)[0]!;sizes[category]=(sizes[category]??0)+stat.size;
    if(mode==='inventory')continue;
    const capturedAt=new Date(Math.min(stat.birthtimeMs||stat.mtimeMs,stat.mtimeMs));
    let metadata=await privateBackupMetadata(file);
    if(!metadata&&stat.size>32*1024*1024) {
      const temporary=file+'.encrypting';await encryptLargePrivateBackup(file,temporary,capturedAt);await rename(temporary,file);
    } else if(!metadata) {
      const original=await readFile(file),encrypted=await encryptPrivateBackup(original,capturedAt);
      // Verify the exact bytes before replacing the plaintext; expired copies
      // are cryptographically checked just before their expiry, then swept.
      const verified=await decryptPrivateBackup(encrypted,new Date(Math.min(Date.now(),capturedAt.getTime()+30*86400000-1)));
      if(!verified.equals(original))throw new Error('PRIVATE_BACKUP_ENCRYPTION_MISMATCH');
      const temporary=file+'.encrypting';await writeFile(temporary,encrypted,{flag:'wx',mode:0o600});await rename(temporary,file);
    }
    metadata=await privateBackupMetadata(file);if(!metadata)throw new Error('PRIVATE_BACKUP_ENCRYPTION_MISSING');
    entries.push({path:relative(root,file),...metadataOnly(metadata),cipherHash:await privateBackupFileHash(file)});
  }
  if(mode==='seal')await writeFile(policyFile,JSON.stringify({version:1,maximumDays:30,files:entries} satisfies Policy),{mode:0o600});
  console.log(JSON.stringify({mode,files:files.length,bytes:bytesTotal,encrypted:entries.length,maximumDays:30,...(mode==='inventory'?{largestCategories:Object.entries(sizes).sort((a,b)=>b[1]-a[1]).slice(0,12)}:{})}));
}
function metadataOnly(value:{capturedAt:string;expiresAt:string}){return{capturedAt:value.capturedAt,expiresAt:value.expiresAt};}
