import type { PrismaClient } from "@prisma/client";
import type { ConversationItem, ConversationSessionRepository, TraceRecord, TraceRepository } from "@casapratica/agents";

export class PrismaConversationSessionRepository implements ConversationSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findById(id: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!session) return null;
    return { id: session.id, workspaceId: session.workspaceId, createdAt: session.startedAt, updatedAt: session.messages.at(-1)?.createdAt ?? session.startedAt, items: session.messages.map((item) => ({ role: item.role as ConversationItem["role"], content: item.content, createdAt: item.createdAt })) };
  }
  async create(workspaceId: string) {
    const session = await this.prisma.agentSession.create({ data: { workspaceId, agentName: "CasaPraticaManagerAgent" } });
    return { id: session.id, workspaceId, items: [], createdAt: session.startedAt, updatedAt: session.startedAt };
  }
  async append(sessionId: string, items: readonly ConversationItem[]): Promise<void> {
    await this.prisma.conversationMessage.createMany({ data: items.map((item) => ({ agentSessionId: sessionId, role: item.role, content: item.content, createdAt: item.createdAt })) });
  }
}

export class PrismaTraceRepository implements TraceRepository {
  constructor(private readonly prisma: PrismaClient, private readonly workspaceId: string) {}
  async append(record: TraceRecord): Promise<void> {
    await this.prisma.auditLog.create({ data: { workspaceId: this.workspaceId, actorType: "agent", actorId: record.agent, action: record.tool ? "tool_execution" : "agent_run", resourceType: record.tool ? "tool" : "agent", resourceId: record.tool, metadata: { durationMs: record.durationMs, status: record.status, errorCode: record.errorCode, usage: record.usage } } });
  }
}
