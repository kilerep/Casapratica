import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {writeFile,rm} from "node:fs/promises";
import path from "node:path";
const root=process.cwd(),pidFile=path.join(root,".casapratica-dev.json");
const targets=[{name:"Web",port:3000,url:"http://127.0.0.1:3000/"},{name:"API",port:3001,url:"http://127.0.0.1:3001/health"}];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const portAvailable=port=>new Promise(resolve=>{const server=createServer();server.unref();server.once("error",()=>resolve(false));server.listen({host:"127.0.0.1",port,exclusive:true},()=>server.close(()=>resolve(true)))});
async function responseOk(url){try{return(await fetch(url,{signal:AbortSignal.timeout(10000)})).status===200}catch{return false}}
async function checkRunning(){const results=await Promise.all(targets.map(async t=>({...t,ok:await responseOk(t.url)}))),assisted=await responseOk("http://127.0.0.1:3001/api/assisted-publication/products");for(const r of results)console.log(`${r.ok?"OK":"ERRO"} ${r.name}: ${r.url}`);console.log(`${assisted?"OK":"ERRO"} Publicação assistida`);if(results.some(r=>!r.ok)||!assisted)process.exitCode=1}
if(process.argv.includes("--check-only"))await checkRunning();else{
 for(const target of targets)if(!await portAvailable(target.port)){console.error(`${target.name} não iniciou: a porta ${target.port} está ocupada. Execute "pnpm doctor" para identificar o processo.`);process.exit(1)}
 const executable=process.env.npm_execpath;if(!executable){console.error("Não foi possível localizar o pnpm.");process.exit(1)}const isScript=/\.(?:c?js|mjs)$/i.test(executable);
 const child=spawn(isScript?process.execPath:executable,[...(isScript?[executable]:[]),"exec","turbo","run","dev"],{cwd:root,env:process.env,stdio:["inherit","pipe","pipe"],detached:process.platform!=="win32"});
 await writeFile(pidFile,JSON.stringify({pid:process.pid,childPid:child.pid,root,startedAt:new Date().toISOString()},null,2));let workerReady=false,settled=false;
 const mirror=(stream,output)=>{stream.setEncoding("utf8");stream.on("data",chunk=>{output.write(chunk);if(chunk.includes("Worker started"))workerReady=true})};mirror(child.stdout,process.stdout);mirror(child.stderr,process.stderr);
 const terminate=()=>{if(!child.pid||child.exitCode!==null)return;if(process.platform==="win32")spawn("taskkill",["/pid",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});else process.kill(-child.pid,"SIGTERM")};
 child.once("exit",async code=>{await rm(pidFile,{force:true}).catch(()=>{});if(!settled&&code!==0)console.error(`Ambiente encerrou antes de ficar pronto (código ${code??"desconhecido"}).`);process.exitCode=code??1});for(const signal of ["SIGINT","SIGTERM"])process.once(signal,terminate);
 const deadline=Date.now()+120000;let web=false,api=false,assisted=false;while(Date.now()<deadline&&!settled){if(child.exitCode!==null)break;[web,api,assisted]=await Promise.all([responseOk(targets[0].url),responseOk(targets[1].url),responseOk("http://127.0.0.1:3001/api/assisted-publication/products")]);if(web&&api&&assisted&&workerReady){settled=true;console.log("\nOK CasaPrática pronto: abra http://127.0.0.1:3000/app\n");break}await wait(500)}if(!settled&&child.exitCode===null){console.error(`Falha ao iniciar: Web=${web}, API=${api}, Publicação assistida=${assisted}, Worker=${workerReady}.`);terminate();process.exitCode=1}
}
