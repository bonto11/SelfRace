export type CancelPlannedResponse = SetTierResponse; 

export type AppSubscriptionTier = {
  id: number;
  code: string; // "free", "classic", "pro"
  name: string;
  description: string | null;
  monthly_price_cents: number;
  ai_monthly_tokens_limit: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
};

export type AppUserSubscription = {
  id: number;
  user_id: number;
  tier_code: string;
  status: string; // "active", "cancelled", ...
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  external_customer_id: string | null;
  external_subscription_id: string | null;
  meta: any | null;
  created_at: string;
};

export type AppSubscriptionScheduledChange = {
  kind: "downgrade" | "cancel";
  to_tier_code: string | null;
  effective_from: string | null;
};

// --- NOVÉ TYPY PRE ROZDELENÉ TOKENY ---
export type TokenMetrics = {
  input: number;
  output: number;
  total?: number;
};

export type AppSubscriptionAiQuota = {
  limits: TokenMetrics;
  usage: TokenMetrics;
  remaining: TokenMetrics;
  is_over: boolean;
  reset_at: string | null;
};
// --------------------------------------

export type AppSubscriptionStatus = {
  user_id: number;
  tier_code: string; // "free", ak nič iné
  active_subscription: AppUserSubscription | null;
  tiers: AppSubscriptionTier[];
  scheduled_change?: AppSubscriptionScheduledChange | null;
  ai_quota?: AppSubscriptionAiQuota | null; // <-- usage info pre progress bary
};

export type ListTiersResponse = {
  success: boolean;
  items: AppSubscriptionTier[];
  detail?: string | null;
  error?: string | null;
};

export type StatusResponse = {
  success: boolean;
  status: AppSubscriptionStatus | null;
  detail?: string | null;
  error?: string | null;
};

export type HistoryResponse = {
  success: boolean;
  items: AppUserSubscription[];
  detail?: string | null;
  error?: string | null;
};

export type SetTierResponse = {
  success: boolean;
  user: any | null;
  active_subscription: AppUserSubscription | null;
  tier: AppSubscriptionTier | null;
  status?: AppSubscriptionStatus | null;
  detail?: string | null;
  error?: string | null;
};

export type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

export type BillingStatusCardProps = {
  status: AppSubscriptionStatus | null;
  activeTierCode: string;
  plannedChange: PlannedChange;
  loadingStatus: boolean;
  loadingAny: boolean;
  error: string | null;
  onCancelPlannedChange: () => void | Promise<void>;
};

export type BillingTierSelectorProps = {
  tiers: AppSubscriptionTier[];
  activeTierCode: string;
  plannedChange: PlannedChange;
  isBusy: boolean;
  onSetTier: (tierCode: string) => void | Promise<void>;
};

// UPRAVENÉ PROPS PRE USAGE BAR
export type BillingUsageBarProps = {
  aiQuota?: AppSubscriptionAiQuota | null;
};
