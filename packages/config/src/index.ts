import { z } from "zod";
export { z } from "zod";
const booleanFlag=z.preprocess(v=>typeof v==="string"?["1","true","yes"].includes(v.toLowerCase()):v,z.boolean());
export const featureFlagsSchema=z.object({ENABLE_PINTEREST_PILOT:booleanFlag.default(false),ENABLE_META_PILOT:booleanFlag.default(false),ENABLE_REAL_PINTEREST_PUBLISHING:booleanFlag.default(false),ENABLE_REAL_FACEBOOK_PUBLISHING:booleanFlag.default(false),ENABLE_AUTOPILOT:booleanFlag.default(false),ENABLE_SCHEDULED_PUBLISHING:booleanFlag.default(true),ENABLE_REAL_METRICS_IMPORT:booleanFlag.default(false),ENABLE_TEST_PUBLISHING_PROVIDER:booleanFlag.default(false)});
export type FeatureFlags=z.infer<typeof featureFlagsSchema>;
export const loadFeatureFlags=(env:Record<string,string|undefined>=process.env)=>featureFlagsSchema.parse(env);
export const integrationModeSchema=z.enum(["TEST","SANDBOX","PRODUCTION"]).default("TEST");
export const operationalModeSchema=z.enum(["LOCAL","TEST","SANDBOX","PRODUCTION"]);
export type OperationalMode=z.infer<typeof operationalModeSchema>;
export const resolveOperationalMode=(env:Record<string,string|undefined>=process.env):OperationalMode=>{const nodeEnv=env.NODE_ENV??"development",integrationMode=integrationModeSchema.parse(env.INTEGRATION_MODE);return nodeEnv==="production"||integrationMode==="PRODUCTION"?"PRODUCTION":nodeEnv==="development"||env.OPERATIONAL_MODE==="LOCAL"?"LOCAL":integrationMode};
export function applyLocalDevelopmentDefaults(env:NodeJS.ProcessEnv=process.env){if(resolveOperationalMode(env)!=="LOCAL")return env;if(!/^postgres(?:ql)?:\/\//i.test(env.DATABASE_URL??"")){const password=encodeURIComponent(env.POSTGRES_PASSWORD??"change-me-local-only"),port=env.POSTGRES_PORT??"5432";env.DATABASE_URL=`postgresql://casapratica:${password}@localhost:${port}/casapratica`}if(!/^redis(?:s)?:\/\//i.test(env.REDIS_URL??""))env.REDIS_URL=`redis://localhost:${env.REDIS_PORT??"6379"}`;return env;}
export const canUseTestPublishingProvider=(env:Record<string,string|undefined>=process.env)=>env.NODE_ENV!=="production"&&integrationModeSchema.parse(env.INTEGRATION_MODE)!=="PRODUCTION"&&loadFeatureFlags(env).ENABLE_TEST_PUBLISHING_PROVIDER;
export const secretKeys=["password","token","accessToken","refreshToken","authorization","cookie","clientSecret","OPENAI_API_KEY","DATABASE_URL","credentials"] as const;
export function redactSecrets(value:unknown):unknown { if(Array.isArray(value))return value.map(redactSecrets);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,secretKeys.some(s=>k.toLowerCase().includes(s.toLowerCase()))?"[REDACTED]":redactSecrets(v)]));if(typeof value==="string"&&/(postgres(?:ql)?:\/\/[^:]+:[^@]+@|bearer\s+\S+)/i.test(value))return "[REDACTED]";return value; }
