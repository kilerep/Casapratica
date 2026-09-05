import type {PrismaClient} from "@prisma/client";
export class PrismaWorkspaceRepository {
  constructor(private readonly db:PrismaClient){}
  find(id:string){return this.db.workspace.findUnique({where:{id},select:{id:true,name:true,slug:true}})}
  list(limit=2){return this.db.workspace.findMany({orderBy:{createdAt:"asc"},take:limit,select:{id:true,name:true,slug:true}})}
  createLocal(){return this.db.workspace.upsert({where:{slug:"casapratica-local"},update:{},create:{name:"CasaPrática Local",slug:"casapratica-local"},select:{id:true,name:true,slug:true}})}
}
