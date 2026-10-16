import {beforeEach,describe,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({getUser:vi.fn(),deleteUser:vi.fn(),getUserById:vi.fn(),remove:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn(()=>({auth:{getUser:api.getUser,admin:{deleteUser:api.deleteUser,getUserById:api.getUserById}},storage:{from:()=>({remove:api.remove})}}))}));
import {SupabaseAccountAdmin} from '../src/infrastructure/auth/supabase-account-admin.js';
const subject='00000000-0000-4000-8000-000000000001';
const token=(claims:object)=>[Buffer.from('{"alg":"RS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:subject,...claims})).toString('base64url'),'synthetic-signature'].join('.');
const admin=(verify=vi.fn(async()=>({subject})))=>new SupabaseAccountAdmin('https://synthetic.supabase.co','sb_secret_SYNTHETIC_ONLY', {verify});
beforeEach(()=>{vi.clearAllMocks();api.getUser.mockResolvedValue({data:{user:{id:subject}},error:null});api.deleteUser.mockResolvedValue({error:null});api.getUserById.mockResolvedValue({error:{code:'user_not_found'}});api.remove.mockResolvedValue({error:null});});
describe('server-only Supabase Auth Admin contract',()=>{
 it('requires cryptographic proof and a fresh password AMR confirmed against Supabase',async()=>{
   const verify=vi.fn(async()=>({subject})),client=admin(verify),jwt=token({amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
   await client.verifyFresh(jwt,subject);expect(verify).toHaveBeenCalledWith(jwt);expect(api.getUser).toHaveBeenCalledWith(jwt);
 });
 it.each([{iat:Math.floor(Date.now()/1000),amr:[{method:'password',timestamp:1}]},{amr:[{method:'token_refresh',timestamp:Math.floor(Date.now()/1000)}]},{user_metadata:{amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]}}])('rejects refresh/user metadata in place of reauthentication',async claims=>{
   await expect(admin().verifyFresh(token(claims),subject)).rejects.toMatchObject({code:'ACCOUNT_REAUTH_REQUIRED'});
 });
 it('rejects a different account and a forged signature before using the proof',async()=>{
   await expect(admin().verifyFresh(token({}),'another')).rejects.toMatchObject({code:'ACCOUNT_REAUTH_REQUIRED'});
   const verify=vi.fn(async()=>null);
   await expect(new SupabaseAccountAdmin('https://synthetic.supabase.co','sb_secret_SYNTHETIC_ONLY',{verify}).verifyFresh(token({}),subject)).rejects.toMatchObject({code:'ACCOUNT_REAUTH_REQUIRED'});
   expect(api.getUser).not.toHaveBeenCalled();
 });
 it('performs physical official deletion and verifies absence before success',async()=>{
   await admin().deleteUser(subject);expect(api.deleteUser).toHaveBeenCalledWith(subject,false);expect(api.getUserById).toHaveBeenCalledWith(subject);
 });
 it('does not claim success on provider failure or a user still present',async()=>{
   api.deleteUser.mockResolvedValueOnce({error:{code:'timeout',message:'SYNTHETIC_PRIVATE_PROVIDER_DETAIL'}});
   await expect(admin().deleteUser(subject)).rejects.toMatchObject({code:'ACCOUNT_DELETION_PENDING'});
   api.getUserById.mockResolvedValueOnce({data:{user:{id:subject}},error:null});
   await expect(admin().deleteUser(subject)).rejects.toMatchObject({code:'ACCOUNT_DELETION_PENDING'});
 });
 it('accepts an already deleted Auth user only after confirming absence',async()=>{
   api.deleteUser.mockResolvedValueOnce({error:{code:'user_not_found'}});await admin().deleteUser(subject);
 });
});
