import { createClient } from "npm:@supabase/supabase-js@2";

export const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-recovery-key","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
export const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder();

export function res(v:any,status=200){return new Response(JSON.stringify(v),{status,headers:cors})}
function b64(a:Uint8Array){let s="";for(const x of a)s+=String.fromCharCode(x);return btoa(s)}
export async function sha(v:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))))}

export type BranchAuth={session:any,user:any,branch:any,branchId:string,tokenHash:string};

export async function authBranch(req:Request):Promise<BranchAuth|null>{
  const h=req.headers.get("authorization")||"",raw=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
  if(!raw)return null;
  const tokenHash=await sha(raw),now=new Date().toISOString();
  const{data:s,error:se}=await db.from("app_sessions").select("id,user_id,branch_id,expires_at").eq("token_hash",tokenHash).gt("expires_at",now).maybeSingle();
  if(se||!s?.branch_id)return null;
  const{data:u,error:ue}=await db.from("app_users").select("*").eq("id",s.user_id).eq("branch_id",s.branch_id).eq("access_enabled",true).maybeSingle();
  if(ue||!u||String(u.branch_id)!==String(s.branch_id))return null;
  const{data:b,error:be}=await db.from("branches").select("id,branch_code,branch_name,school_name,location,academic_year,active").eq("id",s.branch_id).eq("active",true).maybeSingle();
  if(be||!b)return null;
  await db.from("app_sessions").update({last_seen_at:now}).eq("id",s.id).eq("branch_id",s.branch_id);
  return{session:s,user:u,branch:b,branchId:String(s.branch_id),tokenHash};
}

export async function requireOwnedId(table:string,id:string|undefined|null,branchId:string,label:string){
  if(!id)return null;
  const{data,error}=await db.from(table).select("id,branch_id").eq("id",id).eq("branch_id",branchId).maybeSingle();
  if(error)throw error;if(!data)throw new Error(`${label} is outside this branch.`);return data;
}

export async function requireOwnedIds(table:string,ids:string[],branchId:string,label:string){
  const unique=[...new Set((ids||[]).filter(Boolean))];if(!unique.length)return[];
  const{data,error}=await db.from(table).select("id,branch_id").eq("branch_id",branchId).in("id",unique);if(error)throw error;
  if((data||[]).length!==unique.length)throw new Error(`${label} contains records outside this branch.`);return unique;
}

export function publicBranch(b:any){return{id:b.id,code:b.branch_code,name:b.branch_name,school_name:b.school_name,location:b.location,academic_year:b.academic_year}}
