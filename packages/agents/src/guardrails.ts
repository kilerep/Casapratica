const credentialPatterns = [/\bsk-[a-z0-9_-]{16,}\b/i, /\b(?:password|senha|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i];
const unverifiableClaimPatterns = [/menor pre[cç]o garantido/i, /mais vendido/i, /100% garantido/i, /vendas comprovadas/i];
const publicationPatterns = [/\b(?:publique|publicar|poste|postar|agende|agendar)\b/i];
const externalActionPatterns = [/\b(?:enviar|excluir|comprar|publicar|agendar|alterar conta)\b/i];

export interface GuardrailResult { readonly allowed: boolean; readonly code: string | null; readonly approvalsRequired: readonly { action: string; reason: string }[] }
export function validateInput(message: string): GuardrailResult {
  if (credentialPatterns.some((pattern) => pattern.test(message))) return { allowed: false, code: "credentials_detected", approvalsRequired: [] };
  const approvalsRequired: { action: string; reason: string }[] = [];
  if (publicationPatterns.some((pattern) => pattern.test(message))) approvalsRequired.push({ action: "publication", reason: "Toda publicação requer confirmação e approval engine." });
  else if (externalActionPatterns.some((pattern) => pattern.test(message))) approvalsRequired.push({ action: "external_action", reason: "Ações externas exigem confirmação real." });
  return { allowed: true, code: null, approvalsRequired };
}
export function validateOutput(message: string): GuardrailResult {
  if (credentialPatterns.some((pattern) => pattern.test(message))) return { allowed: false, code: "credential_leak", approvalsRequired: [] };
  if (unverifiableClaimPatterns.some((pattern) => pattern.test(message))) return { allowed: false, code: "unsupported_commercial_claim", approvalsRequired: [] };
  const links = message.match(/https?:\/\/[^\s)]+/g) ?? [];
  if (links.some((link) => { try { const url = new URL(link); return !["http:", "https:"].includes(url.protocol); } catch { return true; } })) return { allowed: false, code: "invalid_link", approvalsRequired: [] };
  return { allowed: true, code: null, approvalsRequired: [] };
}
