import { createHash } from "node:crypto";
import type { AssistedPackInput, ManualProductInput, PrismaAssistedPublicationRepository } from "@casapratica/database";

type Variant = { title:string|null; body:string; metadata:Readonly<Record<string,unknown>> };
type Generated = { variants:readonly Variant[] };
type ContentGenerator = { generateProduct(input:{workspaceId:string;productId:string;platforms:readonly ("pinterest"|"facebook")[];variants:number}):Promise<Generated> };
const strings=(value:unknown)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[];
const text=(value:unknown)=>typeof value==="string"?value:null;

export class AssistedPublicationService {
  constructor(private readonly repository:PrismaAssistedPublicationRepository,private readonly content:ContentGenerator) {}
  products(workspaceId:string){return this.repository.listProducts(workspaceId);}
  manualProduct(workspaceId:string,input:ManualProductInput){return this.repository.createManualProduct(workspaceId,input);}
  async prepare(workspaceId:string,productId:string,platform:"pinterest"|"facebook") {
    const product=await this.repository.product(workspaceId,productId);
    const generated=await this.content.generateProduct({workspaceId,productId,platforms:[platform],variants:1});
    const variant=generated.variants[0];if(!variant)throw new Error("content_not_generated");
    const meta=variant.metadata,title=platform==="pinterest"?(variant.title??product.name).slice(0,100):null;
    const disclosure=text(meta.affiliateDisclosure);
    const base=variant.body.slice(0,800);
    const body=platform==="pinterest"&&disclosure&&!base.includes(disclosure)?`${base.slice(0,Math.max(0,798-disclosure.length))}\n\n${disclosure}`.slice(0,800):base;
    const keywords=strings(meta.keywords).slice(0,12),boardSuggestion=platform==="pinterest"?text(meta.boardSuggestion):null;
    const manualSteps=platform==="pinterest"?["Abrir o Pinterest e criar um Pin.","Enviar a imagem real do produto.","Colar título, descrição e link.",`Selecionar a pasta sugerida: ${boardSuggestion??"revisar no Pinterest"}.`,"Revisar interesses e marcar produtos no Pinterest.","Agendamento é opcional e manual.","Revisar configurações avançadas antes de publicar."]:["Criar uma publicação manual na Página do Facebook.","Enviar a imagem real do produto.","Colar o texto principal.",...(text(meta.linkPlacement)==="COMMENT"?["Publicar e adicionar o link manualmente no comentário."]:product.destinationUrl?["Adicionar o link conforme indicado."]:[])];
    const fingerprint=createHash("sha256").update(JSON.stringify({productId,platform,title,body,destinationUrl:product.destinationUrl})).digest("hex");
    const input:AssistedPackInput={productId,platform,image:product.image,title,body,destinationUrl:product.destinationUrl,affiliateUrl:product.affiliateUrl,boardSuggestion,keywords,manualSteps,contentFingerprint:fingerprint};
    return this.repository.savePack(workspaceId,input);
  }
  markPublished(workspaceId:string,id:string,actor:string,date:Date){return this.repository.markPublished(workspaceId,id,actor,date);}
  history(workspaceId:string){return this.repository.history(workspaceId);}
}
