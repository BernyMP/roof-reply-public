export interface QuotaLimits {
  monthlySmslimit: number;
  monthlyAiLimit: number;
  monthlyLeadLimit: number;
  dailySmsLimit: number;
  dailyAiLimit: number;
  dailyLeadLimit: number;
  isActive: boolean;
}

export interface UsageCounters {
  smsOutbound: number;
  aiCalls: number;
  leadsCreated: number;
}

export interface PendingUsageIncrement {
  smsOutbound?: number;
  aiCalls?: number;
  leadsCreated?: number;
}

export interface QuotaStatus {
  exceeded: boolean;
  reason?: string;
  message?: string;
  current?: number;
  limit?: number;
}

function nextValue(current: number, increment?: number): number {
  return current + (increment ?? 0);
}

export function evaluateQuotaStatus(args: {
  limits: QuotaLimits;
  todayUsage: UsageCounters;
  monthlyUsage: UsageCounters;
  pending?: PendingUsageIncrement;
}): QuotaStatus {
  const { limits, todayUsage, monthlyUsage, pending } = args;

  if (!limits.isActive) {
    return {
      exceeded: true,
      reason: "account_disabled",
      message: "Account has been disabled due to quota violations",
    };
  }

  const projectedTodaySms = nextValue(
    todayUsage.smsOutbound,
    pending?.smsOutbound,
  );
  if (
    (!pending || (pending.smsOutbound ?? 0) > 0) &&
    (todayUsage.smsOutbound >= limits.dailySmsLimit ||
      projectedTodaySms > limits.dailySmsLimit)
  ) {
    return {
      exceeded: true,
      reason: "daily_sms_limit",
      message: `Daily SMS limit (${limits.dailySmsLimit}) exceeded`,
      current: projectedTodaySms,
      limit: limits.dailySmsLimit,
    };
  }

  const projectedTodayAi = nextValue(todayUsage.aiCalls, pending?.aiCalls);
  if (
    (!pending || (pending.aiCalls ?? 0) > 0) &&
    (todayUsage.aiCalls >= limits.dailyAiLimit ||
      projectedTodayAi > limits.dailyAiLimit)
  ) {
    return {
      exceeded: true,
      reason: "daily_ai_limit",
      message: `Daily AI call limit (${limits.dailyAiLimit}) exceeded`,
      current: projectedTodayAi,
      limit: limits.dailyAiLimit,
    };
  }

  const projectedTodayLeads = nextValue(
    todayUsage.leadsCreated,
    pending?.leadsCreated,
  );
  if (
    (!pending || (pending.leadsCreated ?? 0) > 0) &&
    (todayUsage.leadsCreated >= limits.dailyLeadLimit ||
      projectedTodayLeads > limits.dailyLeadLimit)
  ) {
    return {
      exceeded: true,
      reason: "daily_lead_limit",
      message: `Daily lead limit (${limits.dailyLeadLimit}) exceeded`,
      current: projectedTodayLeads,
      limit: limits.dailyLeadLimit,
    };
  }

  const projectedMonthlySms = nextValue(
    monthlyUsage.smsOutbound,
    pending?.smsOutbound,
  );
  if (
    (!pending || (pending.smsOutbound ?? 0) > 0) &&
    (monthlyUsage.smsOutbound >= limits.monthlySmslimit ||
      projectedMonthlySms > limits.monthlySmslimit)
  ) {
    return {
      exceeded: true,
      reason: "monthly_sms_limit",
      message: `Monthly SMS limit (${limits.monthlySmslimit}) exceeded`,
      current: projectedMonthlySms,
      limit: limits.monthlySmslimit,
    };
  }

  const projectedMonthlyAi = nextValue(monthlyUsage.aiCalls, pending?.aiCalls);
  if (
    (!pending || (pending.aiCalls ?? 0) > 0) &&
    (monthlyUsage.aiCalls >= limits.monthlyAiLimit ||
      projectedMonthlyAi > limits.monthlyAiLimit)
  ) {
    return {
      exceeded: true,
      reason: "monthly_ai_limit",
      message: `Monthly AI call limit (${limits.monthlyAiLimit}) exceeded`,
      current: projectedMonthlyAi,
      limit: limits.monthlyAiLimit,
    };
  }

  const projectedMonthlyLeads = nextValue(
    monthlyUsage.leadsCreated,
    pending?.leadsCreated,
  );
  if (
    (!pending || (pending.leadsCreated ?? 0) > 0) &&
    (monthlyUsage.leadsCreated >= limits.monthlyLeadLimit ||
      projectedMonthlyLeads > limits.monthlyLeadLimit)
  ) {
    return {
      exceeded: true,
      reason: "monthly_lead_limit",
      message: `Monthly lead limit (${limits.monthlyLeadLimit}) exceeded`,
      current: projectedMonthlyLeads,
      limit: limits.monthlyLeadLimit,
    };
  }

  return { exceeded: false };
}
