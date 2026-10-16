import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { appendFile,open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

/** Windows operator copies only. Never shipped to the browser or used for live DB state. */
const encoding = 'gachaimpact-private-backup-aes256gcm-v1';
const maximumAge = 30 * 24 * 60 * 60 * 1000;
const binaryMagic=Buffer.from('GI_PRIVATE_BACKUP_V1\n');
type Envelope = { encoding: typeof encoding; capturedAt: string; expiresAt: string; iv: string; tag: string; data: string };
let cachedKey: Buffer | undefined;
export function privateBackupDirectory() {
  const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8',windowsHide:true}).trim();
  const directory=resolve(root,'local-data','private-backups');
  execFileSync('git',['check-ignore','--quiet','--',join(directory,'key.dpapi')],{stdio:'ignore',windowsHide:true});
  return directory;
}
function dpapi(bytes: Buffer, decrypt: boolean) {
  if(process.platform!=='win32')throw new Error('PRIVATE_BACKUP_WINDOWS_REQUIRED');
  const operation=decrypt?'Unprotect':'Protect';
  const command=`Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${operation}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($r))`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{input:bytes.toString('base64'),encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error('PRIVATE_BACKUP_KEY_UNAVAILABLE');
  return Buffer.from(result.stdout,'base64');
}
async function key(create=false) {
  if(cachedKey)return cachedKey;
  const directory=privateBackupDirectory(),file=join(directory,'key.dpapi');
  if(create)await mkdir(directory,{recursive:true});
  try { cachedKey=dpapi(await readFile(file),true); }
  catch(error) {
    if(!create||!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT'))throw error;
    cachedKey=randomBytes(32);await writeFile(file,dpapi(cachedKey,false),{flag:'wx',mode:0o600});
  }
  if(cachedKey.length!==32)throw new Error('PRIVATE_BACKUP_KEY_INVALID');
  return cachedKey;
}
export function isPrivateBackup(bytes: Buffer) {
  return bytes.subarray(0,binaryMagic.length).equals(binaryMagic)||bytes.subarray(0,128).toString('utf8').includes(`"encoding":"${encoding}"`);
}
export async function privateBackupMetadata(file:string) {
  const handle=await open(file,'r');
  try {
    const bytes=Buffer.alloc(4096);const {bytesRead}=await handle.read(bytes);const prefix=bytes.subarray(0,bytesRead);
    if(prefix.subarray(0,binaryMagic.length).equals(binaryMagic)) {
      const length=prefix.readUInt32BE(binaryMagic.length);
      if(length>2048)throw new Error('PRIVATE_BACKUP_HEADER_INVALID');
      return {...JSON.parse(prefix.subarray(binaryMagic.length+4,binaryMagic.length+4+length).toString('utf8')) as {capturedAt:string;expiresAt:string;iv:string},offset:binaryMagic.length+4+length};
    }
    if(!isPrivateBackup(prefix))return null;
    // Dates precede the payload in the small-file JSON format.
    const date=(name:string)=>new RegExp(`"${name}":"([^"]+)"`).exec(prefix.toString('utf8'))?.[1];
    const capturedAt=date('capturedAt'),expiresAt=date('expiresAt');
    if(!capturedAt||!expiresAt)throw new Error('PRIVATE_BACKUP_HEADER_INVALID');
    return {capturedAt,expiresAt,iv:'',offset:0};
  }finally{await handle.close();}
}
export async function privateBackupFileHash(file:string) {
  const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes as Buffer);return hash.digest('hex');
}
export async function encryptLargePrivateBackup(file:string,target:string,capturedAt:Date) {
  const dates={capturedAt:capturedAt.toISOString(),expiresAt:new Date(capturedAt.getTime()+maximumAge).toISOString()},iv=randomBytes(12);
  const header=Buffer.from(JSON.stringify({...dates,iv:iv.toString('base64')})),length=Buffer.alloc(4);length.writeUInt32BE(header.length);
  const cipher=createCipheriv('aes-256-gcm',await key(true),iv);cipher.setAAD(Buffer.from(JSON.stringify(dates)));
  await writeFile(target,Buffer.concat([binaryMagic,length,header]),{flag:'wx',mode:0o600});
  await pipeline(createReadStream(file),cipher,createWriteStream(target,{flags:'a'}));
  await appendFile(target,cipher.getAuthTag());
  const originalHash=await privateBackupFileHash(file),stat=await lstat(target),offset=binaryMagic.length+4+header.length;
  const handle=await open(target,'r'),tag=Buffer.alloc(16);try{await handle.read(tag,0,16,stat.size-16);}finally{await handle.close();}
  const decipher=createDecipheriv('aes-256-gcm',await key(),iv);decipher.setAAD(Buffer.from(JSON.stringify(dates)));decipher.setAuthTag(tag);
  const verification=createHash('sha256');
  const input=createReadStream(target,{start:offset,end:stat.size-17});input.pipe(decipher);
  for await(const bytes of decipher)verification.update(bytes as Buffer);
  if(verification.digest('hex')!==originalHash)throw new Error('PRIVATE_BACKUP_ENCRYPTION_MISMATCH');
}
export async function encryptPrivateBackup(bytes: Buffer,capturedAt=new Date()) {
  if(!Number.isFinite(capturedAt.getTime())||capturedAt.getTime()>Date.now()+60_000)throw new Error('PRIVATE_BACKUP_DATE_INVALID');
  const dates={capturedAt:capturedAt.toISOString(),expiresAt:new Date(capturedAt.getTime()+maximumAge).toISOString()};
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await key(true),iv);
  cipher.setAAD(Buffer.from(JSON.stringify(dates)));
  const data=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.from(JSON.stringify({encoding,...dates,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')} satisfies Envelope));
}
export async function decryptPrivateBackup(bytes: Buffer,now=new Date()) {
  if(bytes.subarray(0,binaryMagic.length).equals(binaryMagic)) {
    const length=bytes.readUInt32BE(binaryMagic.length),offset=binaryMagic.length+4+length;
    const metadata=JSON.parse(bytes.subarray(binaryMagic.length+4,offset).toString('utf8')) as {capturedAt:string;expiresAt:string;iv:string};
    if(Date.parse(metadata.expiresAt)-Date.parse(metadata.capturedAt)!==maximumAge||now.getTime()>=Date.parse(metadata.expiresAt))throw new Error('PRIVATE_BACKUP_EXPIRED_OR_INVALID');
    const decipher=createDecipheriv('aes-256-gcm',await key(),Buffer.from(metadata.iv,'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify({capturedAt:metadata.capturedAt,expiresAt:metadata.expiresAt})));decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(offset,-16)),decipher.final()]);
  }
  const envelope=JSON.parse(bytes.toString('utf8')) as Envelope;
  const captured=Date.parse(envelope.capturedAt),expires=Date.parse(envelope.expiresAt);
  if(envelope.encoding!==encoding||!Number.isFinite(captured)||expires-captured!==maximumAge||now.getTime()>=expires)
    throw new Error('PRIVATE_BACKUP_EXPIRED_OR_INVALID');
  const decipher=createDecipheriv('aes-256-gcm',await key(),Buffer.from(envelope.iv,'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify({capturedAt:envelope.capturedAt,expiresAt:envelope.expiresAt})));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);
}
export async function readPrivateBackup(file: string) {
  const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('PRIVATE_BACKUP_LOCAL_ONLY');
  const bytes=await readFile(file);
  return isPrivateBackup(bytes)?decryptPrivateBackup(bytes):bytes;
}
