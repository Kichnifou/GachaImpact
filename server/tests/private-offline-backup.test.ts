import { describe,it,expect } from 'vitest';
import { encryptPrivateBackup,decryptPrivateBackup,isPrivateBackup } from '../src/application/migration/private-offline-backup.js';
describe.skipIf(process.platform!=='win32')('Windows private backup retention, synthetic bytes only',()=>{
  it('roundtrips exact bytes and refuses expired or altered ciphertext',async()=>{
    const bytes=Buffer.from('synthetic player fixture\0no real account'),captured=new Date();
    const encrypted=await encryptPrivateBackup(bytes,captured);
    expect(isPrivateBackup(encrypted)).toBe(true);expect(encrypted.toString()).not.toContain('synthetic player');
    expect(await decryptPrivateBackup(encrypted)).toEqual(bytes);
    await expect(decryptPrivateBackup(encrypted,new Date(captured.getTime()+30*86400000))).rejects.toThrow('EXPIRED');
    const tampered=JSON.parse(encrypted.toString());tampered.expiresAt=new Date(captured.getTime()+31*86400000).toISOString();
    await expect(decryptPrivateBackup(Buffer.from(JSON.stringify(tampered)))).rejects.toThrow('INVALID');
    const corrupt=JSON.parse(encrypted.toString());corrupt.data=Buffer.from('tamper').toString('base64');
    await expect(decryptPrivateBackup(Buffer.from(JSON.stringify(corrupt)))).rejects.toThrow();
  });
});
