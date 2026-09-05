import type {OperationalMode} from "@casapratica/config";
type Workspace={id:string;name:string;slug:string};
export interface OperationalWorkspaceRepository {find(id:string):Promise<Workspace|null>;list(limit?:number):Promise<readonly Workspace[]>;createLocal():Promise<Workspace>}
export async function resolveOperationalWorkspace(repository:OperationalWorkspaceRepository,input:{configuredId?:string|undefined;mode:OperationalMode}){
  if(input.configuredId){const configured=await repository.find(input.configuredId);if(!configured)throw new Error("default_workspace_not_found");return configured}
  if(input.mode==="PRODUCTION")throw new Error("default_workspace_required_in_production");
  if(input.mode!=="LOCAL")throw new Error(`default_workspace_required_in_${input.mode.toLocaleLowerCase()}`);
  const existing=await repository.list(2);
  if(existing.length===1)return existing[0]!;
  if(existing.length>1)throw new Error("multiple_workspaces_require_default_workspace_id");
  return repository.createLocal();
}
