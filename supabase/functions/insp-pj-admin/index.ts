import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const url = Deno.env.get('SUPABASE_URL') ?? '';
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string,string>;
const serviceKey = keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
if (!url || !serviceKey) throw new Error('Supabase server configuration missing.');
const db = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const PIN_ITERATIONS=310000, ATTEMPT_LIMIT=5, LOCK_MS=15*60*1000, SESSION_MS=12*60*60*1000;
const groups=[1,2,3,4], shifts=['TN','TM','TT'], statuses=['Ativo','Afastado','Inativo'];
const json=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const hex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const randomHex=(length:number)=>hex(crypto.getRandomValues(new Uint8Array(length)));
const fromHex=(value:string)=>new Uint8Array(value.match(/.{1,2}/g)?.map(x=>parseInt(x,16))??[]);
async function sha(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
async function derive(pin:string,salt:string,iterations:number){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromHex(salt),iterations,hash:'SHA-256'},key,256)))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function ip(req:Request){return req.headers.get('cf-connecting-ip')??req.headers.get('x-real-ip')??req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown'}
async function login(pin:unknown,remoteIp:string){
  if(typeof pin!=='string'||!/^\\d{4}$/.test(pin))return json({error:'Informe o PIN de 4 números.'},400);
  const now=Date.now(), ipHash=await sha(remoteIp);
  const {data:attempt,error:attemptError}=await db.from('petrus_admin_login_attempts').select('failed_attempts,window_started_at,locked_until').eq('ip_hash',ipHash).maybeSingle();
  if(attemptError)throw attemptError;
  if(attempt?.locked_until&&Date.parse(attempt.locked_until)>now)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
  const {data:credential,error}=await db.from('petrus_admin_credentials').select('pin_salt,pin_hash,pin_iterations').eq('id',1).single();
  if(error)throw error;
  const candidate=await derive(pin,credential.pin_salt,credential.pin_iterations);
  if(!equal(candidate,credential.pin_hash)){
    const active=attempt&&now-Date.parse(attempt.window_started_at)<LOCK_MS;
    const failures=active?attempt.failed_attempts+1:1;
    const locked=failures>=ATTEMPT_LIMIT?new Date(now+LOCK_MS).toISOString():null;
    const {error:writeError}=await db.from('petrus_admin_login_attempts').upsert({ip_hash:ipHash,failed_attempts:failures,window_started_at:active?attempt.window_started_at:new Date(now).toISOString(),locked_until:locked});
    if(writeError)throw writeError;
    return json({error:locked?'Muitas tentativas. O acesso foi bloqueado por 15 minutos.':'PIN incorreto.'},401);
  }
  await db.from('petrus_admin_login_attempts').delete().eq('ip_hash',ipHash);
  const token=randomHex(32), expiresAt=new Date(now+SESSION_MS).toISOString();
  const {error:sessionError}=await db.from('petrus_admin_sessions').insert({token_hash:await sha(token),expires_at:expiresAt});
  if(sessionError)throw sessionError;
  return json({token,expiresAt});
}
async function sessionHash(token:unknown){
  if(typeof token!=='string'||token.length<32||token.length>128)return null;
  const hash=await sha(token);
  const {data,error}=await db.from('petrus_admin_sessions').select('token_hash').eq('token_hash',hash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
  return error||!data?null:hash;
}
function safeStaff(raw:Record<string,unknown>){
  const name=typeof raw.name==='string'?raw.name.trim().replace(/\\s+/g,' '):'';
  const registration=typeof raw.registration==='string'?raw.registration.trim().slice(0,30):'';
  const shift=typeof raw.shift==='string'&&shifts.includes(raw.shift)?raw.shift:null;
  const group=Number(raw.group);
  const rest_group=groups.includes(group)?group:null;
  const status=typeof raw.status==='string'&&statuses.includes(raw.status)?raw.status:'Ativo';
  const id=typeof raw.id==='string'?raw.id.slice(0,100):'';
  if(id.length<3||name.length<2||name.length>160)return null;
  return {id,registration:registration||null,name,shift,rest_group,role:typeof raw.role==='string'?raw.role.trim().slice(0,70)||'Inspetor':'Inspetor',status,team_code:typeof raw.teamCode==='string'?raw.teamCode.slice(0,30):'',team_name:typeof raw.teamName==='string'?raw.teamName.slice(0,100):'',leader:typeof raw.leader==='string'?raw.leader.slice(0,160):'',valid_from:typeof raw.validFrom==='string'?raw.validFrom.slice(0,40):'',notes:typeof raw.notes==='string'?raw.notes.slice(0,300):'',updated_at:new Date().toISOString()};
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  try{
    const body=await req.json() as Record<string,unknown>;
    const action=typeof body.action==='string'?body.action:'';
    if(action==='login')return await login(body.pin,ip(req));
    const tokenHash=await sessionHash(body.token);
    if(!tokenHash)return json({error:'Sessão expirada. Entre novamente com o PIN.'},401);
    if(action==='session.check')return json({valid:true});
    if(action==='logout'){
      const {error}=await db.from('petrus_admin_sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',tokenHash);
      if(error)throw error; return json({success:true});
    }
    if(action==='staff.load'){
      const {data,error}=await db.from('inspection_staff').select('*').order('name');
      if(error)throw error;
      return json({workers:(data??[]).map(row=>({id:row.id,registration:row.registration??'',name:row.name,shift:row.shift??'',group:row.rest_group?String(row.rest_group):'',role:row.role,status:row.status,teamCode:row.team_code,teamName:row.team_name,leader:row.leader,validFrom:row.valid_from,notes:row.notes,updatedAt:row.updated_at}))});
    }
    if(action==='staff.upsert'){
      if(!Array.isArray(body.workers)||body.workers.length>500)return json({error:'Lista inválida (máximo 500 integrantes).'},400);
      const rows=(body.workers as Record<string,unknown>[]).map(safeStaff);
      if(rows.some(row=>row===null))return json({error:'Um ou mais perfis têm dados inválidos.'},400);
      const registrations=rows.map(row=>row!.registration).filter(Boolean);
      if(new Set(registrations).size!==registrations.length)return json({error:'Existem matrículas duplicadas na lista.'},409);
      if(rows.length){
        const {error}=await db.from('inspection_staff').upsert(rows,{onConflict:'id'});
        if(error)throw error;
      }
      return json({success:true,count:rows.length});
    }
    if(action==='staff.delete'){
      if(typeof body.id!=='string')return json({error:'Identificador inválido.'},400);
      const {error}=await db.from('inspection_staff').delete().eq('id',body.id);
      if(error)throw error;return json({success:true});
    }
    if(action==='staff.clear'){
      const {error}=await db.from('inspection_staff').delete().gte('created_at','1970-01-01T00:00:00Z');
      if(error)throw error;return json({success:true});
    }
    return json({error:'Ação não reconhecida.'},400);
  }catch(error){
    console.error('insp-pj-admin error:',error instanceof Error?error.message:'unknown error');
    return json({error:'Não foi possível concluir a operação. Tente novamente.'},500);
  }
});

