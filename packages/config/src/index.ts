import { z } from "zod";
export { z } from "zod";
const booleanFlag=z.preprocess(v=>typeof v==="string"?["1","true","yes"].includes(v.toLowerCase()):v,z.boolean());
export const featureFlagsSchema=z.object({ENABLE_REAL_PINTEREST_PUBLISHING:booleanFlag.default(false),ENABLE_REAL_FACEBOOK_PUBLISHING:booleanFlag.default(false),ENABLE_AUTOPILOT:booleanFlag.default(false),ENABLE_SCHEDULED_PUBLISHING:booleanFlag.default(true),ENABLE_REAL_METRICS_IMPORT:booleanFlag.default(false),ENABLE_TEST_PUBLISHING_PROVIDER:booleanFlag.default(false)});
export type FeatureFlags=z.infer<typeof featureFlagsSchema>;
export const loadFeatureFlags=(env:Record<string,string|undefined>=process.env)=>featureFlagsSchema.parse(env);
export const secretKeys=["password","token","accessToken","refreshToken","authorization","cookie","clientSecret","OPENAI_API_KEY","DATABASE_URL","credentials"] as const;
export function redactSecrets(value:unknown):unknown { if(Array.isArray(value))return value.map(redactSecrets);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,secretKeys.some(s=>k.toLowerCase().includes(s.toLowerCase()))?"[REDACTED]":redactSecrets(v)]));if(typeof value==="string"&&/(postgres(?:ql)?:\/\/[^:]+:[^@]+@|bearer\s+\S+)/i.test(value))return "[REDACTED]";return value; }
