import type {PrismaClient} from '../../../generated/prisma/client.js';
import type {AccountAuthAdmin} from '../../infrastructure/auth/supabase-account-admin.js';
import type {AuthIdentityVerifier} from '../auth/auth-identity-verifier.js';
import {authSubjectHash} from './account-erasure-markers.js';

/** Durable acceptance barrier, independent of the deletion activation key. */
export function accountAccessVerifier(db:PrismaClient,admin:AccountAuthAdmin|undefined,base:AuthIdentityVerifier):AuthIdentityVerifier {
  return {verify:async token=>{
    const identity=await base.verify(token);if(!identity)return null;
    if(await db.accountDeletion.findUnique({where:{subjectHash:authSubjectHash(identity.subject)}}))return null;
    const web=await db.webIdentity.findUnique({where:{provider_providerSubject:{provider:'supabase',providerSubject:identity.subject}},select:{player:{select:{status:true}}}});
    if(web)return web.player.status==='ACTIVE'?identity:null;
    // Provisioning or a deleted user's old JWT cannot recreate an account merely
    // because the short-lived retry hash has expired. Ordinary polling of an
    // existing active account does not add an Auth network roundtrip.
    return !admin||await admin.isLive(token,identity.subject)?identity:null;
  }};
}
