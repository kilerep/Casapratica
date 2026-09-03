export type EntityId = string;
export interface Timestamped { readonly createdAt: Date; readonly updatedAt: Date }
export interface Workspace extends Timestamped { readonly id: EntityId; readonly name: string; readonly slug: string }
export interface Category extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly name: string; readonly slug: string }
export interface Seller extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly marketplace: string; readonly externalId: string; readonly name: string | null; readonly reputation: number | null }
export interface ProductCandidate { readonly id: EntityId; readonly researchRunId: EntityId; readonly productId: EntityId | null; readonly marketplace: string; readonly externalId: string; readonly sourceUrl: string; readonly capturedData: Readonly<Record<string, unknown>>; readonly createdAt: Date }
export interface ProductResearchRun extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly query: string; readonly status: RunStatus; readonly startedAt: Date | null; readonly completedAt: Date | null }
export interface ProductComparison { readonly id: EntityId; readonly researchRunId: EntityId; readonly productId: EntityId; readonly position: number | null; readonly notes: string | null; readonly createdAt: Date }
export interface AffiliateLink extends Timestamped { readonly id: EntityId; readonly productId: EntityId; readonly provider: string; readonly url: string; readonly externalId: string | null; readonly active: boolean }
export interface Content extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly productId: EntityId | null; readonly title: string; readonly body: string; readonly status: "draft" | "ready" | "archived" }
export interface ContentVariant extends Timestamped { readonly id: EntityId; readonly contentId: EntityId; readonly channel: string; readonly title: string | null; readonly body: string; readonly metadata: Readonly<Record<string, unknown>> | null }
export interface CreativeAsset extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly contentId: EntityId | null; readonly kind: string; readonly storageKey: string; readonly mimeType: string; readonly width: number | null; readonly height: number | null; readonly status: "draft" | "ready" | "archived" }
export interface DailyPlan extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly planDate: Date; readonly status: PlanStatus }
export interface WeeklyPlan extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly weekStartsOn: Date; readonly status: PlanStatus }
export interface MetricSnapshot { readonly id: EntityId; readonly workspaceId: EntityId; readonly observedAt: Date; readonly impressions: number | null; readonly clicks: number | null; readonly conversions: number | null; readonly revenue: number | null; readonly currency: string | null }
export interface Conversion { readonly id: EntityId; readonly workspaceId: EntityId; readonly occurredAt: Date; readonly amount: number | null; readonly commission: number | null; readonly currency: string | null }
export interface Experiment extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly name: string; readonly hypothesis: string; readonly status: string }
export interface Strategy extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly name: string; readonly version: number; readonly active: boolean }
export interface StrategyDecision { readonly id: EntityId; readonly strategyId: EntityId; readonly decisionType: string; readonly rationale: string; readonly decidedAt: Date }
export interface IntegrationAccount extends Timestamped { readonly id: EntityId; readonly workspaceId: EntityId; readonly provider: string; readonly status: "disconnected" | "connected" | "degraded" | "revoked" }
export interface IntegrationCapability { readonly id: EntityId; readonly integrationAccountId: EntityId; readonly capability: string; readonly status: "unavailable" | "available" | "limited" }
export interface AgentSession { readonly id: EntityId; readonly workspaceId: EntityId; readonly agentName: string; readonly startedAt: Date; readonly endedAt: Date | null }
export interface AgentRun { readonly id: EntityId; readonly agentSessionId: EntityId; readonly objective: string; readonly status: RunStatus }
export interface ToolExecution { readonly id: EntityId; readonly agentRunId: EntityId; readonly toolName: string; readonly status: RunStatus; readonly input: Readonly<Record<string, unknown>> }
export interface AuditLog { readonly id: EntityId; readonly workspaceId: EntityId; readonly action: string; readonly resourceType: string; readonly occurredAt: Date }
export type RunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type PlanStatus = "draft" | "active" | "completed" | "cancelled";
