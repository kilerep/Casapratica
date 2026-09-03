import type { Category, AuditLog, Workspace } from "./entities.js";
import type { Product } from "./product.js";
import type { PublicationStatus } from "./publication.js";
import type { ScoreResult } from "./score.js";
export interface Repository<T> { findById(id: string): Promise<T | null>; save(entity: T): Promise<void> }
export interface WorkspaceRepository extends Repository<Workspace> { findBySlug(slug: string): Promise<Workspace | null> }
export interface CategoryRepository extends Repository<Category> { listByWorkspace(workspaceId: string): Promise<readonly Category[]> }
export interface ProductRepository extends Repository<Product> { findByExternalId(workspaceId: string, marketplace: string, externalId: string): Promise<Product | null>; listByStatus(workspaceId: string, status: Product["status"]): Promise<readonly Product[]> }
export interface ProductScoreRepository extends Repository<ScoreResult & { readonly id: string; readonly productId: string }> {}
export interface PublicationRepository extends Repository<{ readonly id: string; readonly status: PublicationStatus }> {}
export interface AuditLogRepository { append(log: AuditLog): Promise<void> }
