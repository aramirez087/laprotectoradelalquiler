import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import * as busqueda from '../lib/busqueda-fichas.ts'
import { runtimeMocks } from './helpers/runtime-mocks.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks={}, env={}) {
  const mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText,{module:mod,exports:mod.exports,require:name=>mocks[name]??runtimeMocks[name]??require(name),
    process:{env},Buffer,Date,URLSearchParams,console},{filename:file})
  return mod.exports
}
const proofs=()=>load('lib/resultado-busqueda-confirmado.ts',{'server-only':{}},{SUPABASE_SECRET_KEY:'test-only-secret'})

test('search classification handles normalized documents, foreign IDs, accents and invalid inputs',()=>{
  for(const [q,tipo,valor] of [['1-0234-0567','documento','102340567'],['ＡＢ１２３４','documento','ab1234'],['José Muñoz','nombre','José Muñoz'],['','listado','']]) {
    assert.equal(busqueda.analizarBusqueda(q).tipo,tipo);assert.equal(busqueda.analizarBusqueda(q).valor,valor)
  }
  for(const q of ['%%___','J','123','x'.repeat(151)]) assert.equal(busqueda.analizarBusqueda(q).tipo,'invalida')
})

test('outcome proofs are account-bound, expire, reject tampering and never contain query text',()=>{
  const api=proofs(),now=1000000,q='José Muñoz'
  const token=api.confirmarResultadoBusqueda(7,q,true,undefined,now)
  const proof=api.leerResultadoConfirmado(token,7,now+1)
  assert.ok(proof);assert.equal(proof.persona,null);assert.equal(proof.resultados,true)
  const raw=Buffer.from(token.split('.')[0],'base64url').toString()
  assert.doesNotMatch(raw,/José|Muñoz/)
  for(const [input,user,time] of [[token,8,now],[token,7,now+1800001],[token,7,now-5001],['forged',7,now],[`${token}x`,7,now],[token.replace(/^./,'!'),7,now]]) {
    assert.equal(api.leerResultadoConfirmado(input,user,time),null)
  }
  assert.equal(load('lib/resultado-busqueda-confirmado.ts',{'server-only':{}}).confirmarResultadoBusqueda(7,q,true),null)
  assert.equal(api.confirmarResultadoBusqueda(7,'J',false),null)
})

test('pagination and return journeys deduplicate; changed queries or outcomes get new IDs',()=>{
  const api=proofs(),now=1000000
  const token=api.confirmarResultadoBusqueda(7,'Jose Munoz',true,undefined,now)
  const original=api.leerResultadoConfirmado(token,7,now)
  const next=api.confirmarResultadoBusqueda(7,'Jose Munoz',true,token,now+10)
  assert.equal(api.leerResultadoConfirmado(next,7,now+10).id,original.id)
  for(const [q,results] of [['Ana Mora',true],['Jose Munoz',false]]) {
    const changed=api.confirmarResultadoBusqueda(7,q,results,token,now+10)
    assert.notEqual(api.leerResultadoConfirmado(changed,7,now+10).id,original.id)
  }
  const opened=api.confirmarAperturaFicha(token,7,42,now+10)
  assert.equal(api.leerResultadoConfirmado(opened,7,now+10).persona,42)
  assert.equal(api.contextoBusquedaConfirmado(opened,7,'Ana Mora',42,now+10),null)
  assert.equal(api.contextoBusquedaConfirmado(opened,7,'Jose Munoz',43,now+10),null)
  const returned=api.contextoBusquedaConfirmado(opened,7,'Jose Munoz',42,now+10)
  assert.equal(api.leerResultadoConfirmado(returned,7,now+10).persona,null)
  assert.equal(api.leerResultadoConfirmado(returned,7,now+10).id,original.id)
  assert.equal(api.confirmarAperturaFicha(api.confirmarResultadoBusqueda(7,'Jose',false,undefined,now),7,42,now),null)
})

test('outcome action rechecks access and published content and persists no tenant or query data',async()=>{
  for(const config of [{session:false},{active:false},{role:'admin'},{proof:false},{access:false},{persona:42,published:false},{persona:42},{results:false},{}]) {
    const calls=[],lecturas=[]
    const query={select:(columnas,opts)=>{lecturas.push({columnas,opts});return query},
      eq:()=>query,limit:async()=>({count:config.published===false?0:1,error:null})}
    const prueba={usuario:7,id:'11111111-1111-4111-8111-111111111111',iniciada:1000000,tipo:'nombre',resultados:config.results!==false,consulta:'DO NOT PERSIST',persona:config.persona??null}
    const api=load('lib/actions/resultados-busqueda.ts',{
      '@/lib/dal':{obtenerUsuario:async()=>config.session===false?null:{id:7,activo:config.active!==false,rol:config.role??'propietario'},
        puedeConsultar:async()=>config.access!==false},
      '@/lib/resultado-busqueda-confirmado':{leerResultadoConfirmado:()=>config.proof===false?null:prueba},
      '@/lib/supabase/admin':{createAdmin:()=>({from:table=>{assert.equal(table,'resenas');return query},rpc:async(name,params)=>{calls.push({name,params});return {error:null}}})},
    })
    await api.registrarResultadoBusquedaAction('receipt')
    const blocked=['session','active','proof','access','published'].some(key=>config[key]===false)||config.role==='admin'
    assert.equal(calls.length,blocked?0:1)
    if(calls.length) {
      const data=JSON.stringify(calls[0]);assert.doesNotMatch(data,/DO NOT PERSIST|persona|consulta|q_text/)
      assert.equal(calls[0].params.p_usuario_id,7)
      assert.equal(calls[0].params.p_abrio_ficha,config.persona!=null)
      if(config.persona)assert.deepEqual(JSON.parse(JSON.stringify(lecturas)),[{columnas:'id',opts:{count:'exact',head:true}}])
    }
  }
})

test('client observer respects privacy signals, excludes hidden tabs and sends once when visible',()=>{
  for(const config of [{doNotTrack:'1'},{globalPrivacyControl:true},{visibility:'hidden'},{persist:true},{}]) {
    const calls=[],listeners=new Map()
    const doc={visibilityState:config.visibility??'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}
    const history=[]
    const window={location:{href:'https://example.test/fichas?q=Jose'},history:{replaceState:(_state,_title,url)=>history.push(url)}}
    let cleanup
    const mod={exports:{}}
    vm.runInNewContext(ts.transpileModule(readFileSync('components/resultado-busqueda.tsx','utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
    }).outputText,{module:mod,exports:mod.exports,navigator:config,document:doc,window,URL,require:name=>({
      react:{useEffect:fn=>{cleanup=fn()},startTransition:fn=>fn()},
      '@/lib/actions/resultados-busqueda':{registrarResultadoBusquedaAction:async token=>calls.push(token)},
    })[name]})
    mod.exports.ResultadoBusqueda({confirmacion:'receipt',persistirContexto:config.persist??false})
    assert.equal(calls.length,config.visibility||config.doNotTrack||config.globalPrivacyControl?0:1)
    if(config.visibility) {doc.visibilityState='visible';listeners.get('visibilitychange')();listeners.get('visibilitychange')();assert.equal(calls.length,1)}
    assert.equal(history.length,config.persist?1:0)
    if(config.persist)assert.equal(history[0],'/fichas?q=Jose&consulta=receipt')
    cleanup?.();assert.equal(listeners.size,0)
  }
})
