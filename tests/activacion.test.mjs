import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { runtimeMocks } from './helpers/runtime-mocks.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks={}, env={}) {
  const mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{module:mod,exports:mod.exports,require:name=>mocks[name]??runtimeMocks[name]??require(name),
    process:{env},Buffer,Date,Response,AbortSignal,console},{filename:file})
  return mod.exports
}

test('successful-search proofs are account-bound, expire and cannot be forged',()=>{
  const api=load('lib/consulta-confirmada.ts',{'server-only':{}},{SUPABASE_SECRET_KEY:'test-only-secret'})
  const token=api.confirmarConsulta(7,100000)
  assert.equal(api.consultaConfirmada(token,7,100001),true)
  for(const [input,id,time] of [[token,8,100001],[token,7,700001],[token,7,99999],['bad',7,100001],[token.replace(/.$/,'z'),7,100001]]) {
    assert.equal(api.consultaConfirmada(input,id,time),false)
  }
  assert.equal(load('lib/consulta-confirmada.ts',{'server-only':{}}).confirmarConsulta(7),null)
})

test('first-search action rechecks session, proof and access before recording, without query data',async()=>{
  for(const config of [{activo:false},{rol:'admin'},{proof:false},{access:false},{}]) {
    const calls=[]
    const api=load('lib/actions/activacion.ts',{
      '@/lib/consulta-confirmada':{consultaConfirmada:()=>config.proof!==false},
      '@/lib/dal':{requireUsuario:async()=>({id:7,activo:config.activo!==false,rol:config.rol??'propietario'}),puedeConsultar:async()=>config.access!==false},
      '@/lib/supabase/admin':{createAdmin:()=>({rpc:async(name,params)=>{calls.push({name,params});return{error:null}}})},
      '@/lib/avisos-moderacion':{},'next/cache':{},
    })
    await api.registrarPrimeraConsultaAction('proof')
    assert.equal(calls.length,Object.keys(config).length?0:1)
    if(calls.length) assert.equal(JSON.stringify(calls[0]),JSON.stringify({name:'registrar_primera_consulta',params:{p_usuario_id:7}}))
  }
})

test('draft actions use the session author, reject invalid data and report version conflicts',async()=>{
  const {CamposBorrador}=load('lib/borrador-resena.ts')
  const calls=[]
  const api=load('lib/actions/borrador-resena.ts',{
    '@/lib/borrador-resena':{CamposBorrador},
    '@/lib/dal':{requireUsuario:async()=>({id:7,activo:true}),puedeConsultar:async()=>false},
    '@/lib/supabase/admin':{createAdmin:()=>({rpc:async(name,params)=>{calls.push({name,params});return{data:[{guardado:false}],error:null}}})},
  })
  const datos={identificacion:'123456',nombre:'Ana',nombre2:'',apellido1:'Mora',apellido2:'',comentario:'Draft',anonima:false}
  const result=await api.guardarBorradorResena({personaId:null,version:null,datos})
  assert.equal(result.conflicto,true)
  assert.equal(calls[0].params.p_autor_id,7)
  for(const input of [{personaId:1,version:null,datos},{personaId:null,version:null,datos:{...datos,comentario:'x'.repeat(5001)}},{personaId:null,version:'forged',datos}]) {
    assert.ok((await api.guardarBorradorResena(input)).error)
  }
  assert.equal(calls.length,1)
})

test('moderation messages have actionable links and never expose tenant data or correction notes',()=>{
  const {contenidoAvisoModeracion}=load('lib/aviso-moderacion.ts')
  const input={resena_id:42,nombre:'Author',comentario:'PRIVATE REVIEW',identificacion:'PRIVATE DOCUMENT',nota:'PRIVATE NOTE'}
  for(const accion of ['aprobada','corregir','rechazada']) {
    const message=contenidoAvisoModeracion({...input,accion})
    assert.ok(message.accion.url.startsWith('https://www.protectoradelalquiler.com/perfil#'))
    assert.doesNotMatch(JSON.stringify(message),/PRIVATE|3 meses/)
    if(accion==='corregir') assert.match(message.accion.texto,/Corregir/)
  }
})

test('durable worker uses persisted payloads and keys, isolates failures and does not send after a lost lease',async()=>{
  const sends=[],finished=[]
  const avisos=[{id:'one',token:'token-one',cuerpo:{subject:'Frozen',from:'previous sender'}},
    {id:'two',token:'lost-lease',cuerpo:{subject:'Do not send'}},
    {id:'three',token:'token-three',cuerpo:{subject:'Retry'}}]
  const api=load('lib/avisos-moderacion.ts',{
    'server-only':{},
    '@/lib/aviso-moderacion':{contenidoAvisoModeracion:()=>{throw Error('persisted messages must be reused')}},
    '@/lib/correo-resenas':{correoResenasConfigurado:()=>true,enviarCuerpoCorreo:async(body,key)=>{sends.push({body,key});return{estado:body.subject==='Retry'?'pendiente':'enviada',proveedorId:'provider-id'}}},
    '@/lib/supabase/admin':{createAdmin:()=>({rpc:async(name,params)=>{
      if(name==='reclamar_avisos_moderacion') return{data:avisos}
      if(name==='preparar_aviso_moderacion') return{data:params.p_id==='two'?null:params.p_cuerpo}
      if(name==='finalizar_aviso_moderacion') finished.push(params)
      return{error:null}
    }})},
  })
  const result=await api.procesarAvisosModeracion()
  assert.equal(result.enviadas,1);assert.equal(result.pendientes,1)
  assert.deepEqual(sends.map(s=>s.key),['moderacion/one','moderacion/three'])
  assert.equal(sends[0].body.from,'previous sender')
  assert.equal(finished[0].p_token,'token-one')
})

test('scheduler endpoint rejects missing, incorrect and non-ASCII credentials without calling the worker',async()=>{
  const calls=[]
  const api=load('app/api/avisos/route.ts',{
    '@/lib/avisos-moderacion':{procesarAvisosModeracion:async()=>{calls.push(1);return{enviadas:1}}},
  },{CRON_SECRET:'test-secret'})
  for(const authorization of ['', 'Bearer wrong','Bearer éééééé']) {
    const response=await api.GET(new Request('https://example.test/api/avisos',{headers:{authorization}}))
    assert.equal(response.status,401)
  }
  assert.equal(calls.length,0)
  const response=await api.GET(new Request('https://example.test/api/avisos',{headers:{authorization:'Bearer test-secret'}}))
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls.length,1)
})
