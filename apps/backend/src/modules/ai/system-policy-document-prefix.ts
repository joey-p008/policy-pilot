export const SYSTEM_POLICY_DOCUMENT_PREFIX = {
  DATA_WAREHOUSE: 'POL-2026-01-DGW',
  FINANCE_ANALYTICS_DB: 'POL-2026-01-DGW',
  RAW_ANALYTICS_LAKE: 'POL-2026-01-DGW',
  CLOUD_INFRASTRUCTURE: 'POL-2026-02-SEC',
  PROD_DEPLOYMENT_PIPELINE: 'POL-2026-02-SEC',
  KUBERNETES_CLUSTER: 'POL-2026-02-SEC',
  GITHUB_ENTERPRISE_TENANT: 'POL-2026-02-SEC',
  SOURCE_CODE_VAULT: 'POL-2026-02-SEC',
  ARTIFACT_PACKAGE_REGISTRY: 'POL-2026-02-SEC',
  CRM_SYSTEM: 'POL-2026-03-CRM',
  CUSTOMER_360_DB: 'POL-2026-03-CRM',
  IDP_DIRECTORY: 'POL-2026-04-IDP',
  OKTA_AUTH0_TENANT: 'POL-2026-04-IDP',
  ACTIVE_DIRECTORY: 'POL-2026-04-IDP',
  HRIS_WORKDAY: 'POL-2026-05-HRP',
  PAYROLL_SYSTEM: 'POL-2026-05-HRP',
  LLM_PROMPT_GATEWAY: 'POL-2026-06-AIG',
  AI_MODEL_REGISTRY: 'POL-2026-06-AIG',
  SWIFT_WIRE_SYSTEM: 'POL-2026-07-TRE',
  TREASURY_BANK_PORTAL: 'POL-2026-07-TRE',
  STRIPE_PAYMENT_GATEWAY: 'POL-2026-07-TRE',
  SIEM_LOG_AGGREGATOR: 'POL-2026-08-SOC',
  EDR_HOST_PLATFORM: 'POL-2026-08-SOC',
  FIREWALL_RULE_ENGINE: 'POL-2026-08-SOC',
} as const;

export type MappedAccessRequestSystemName = keyof typeof SYSTEM_POLICY_DOCUMENT_PREFIX;

function extractSystemName(targetResource: string): string {
  const trimmed = targetResource.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return trimmed.split(/\s*\/\s*/)[0] ?? trimmed;
}

export function resolvePolicyDocumentPrefix(targetResource: string): string | undefined {
  const systemName = extractSystemName(targetResource);
  if (systemName.length === 0) {
    return undefined;
  }
  if (!(systemName in SYSTEM_POLICY_DOCUMENT_PREFIX)) {
    return undefined;
  }
  return SYSTEM_POLICY_DOCUMENT_PREFIX[systemName as MappedAccessRequestSystemName];
}
