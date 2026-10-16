import test from "node:test";
import assert from "node:assert/strict";

import { evaluateQuotaStatus } from "./usage-control.ts";

const baseLimits = {
  monthlySmslimit: 5000,
  monthlyAiLimit: 2000,
  monthlyLeadLimit: 500,
  dailySmsLimit: 200,
  dailyAiLimit: 100,
  dailyLeadLimit: 50,
  isActive: true,
} as const;

test("allows usage that reaches but does not exceed a limit", () => {
  const result = evaluateQuotaStatus({
    limits: { ...baseLimits },
    todayUsage: { smsOutbound: 199, aiCalls: 10, leadsCreated: 3 },
    monthlyUsage: { smsOutbound: 1000, aiCalls: 100, leadsCreated: 20 },
    pending: { smsOutbound: 1 },
  });

  assert.equal(result.exceeded, false);
});

test("blocks usage that would exceed a daily limit", () => {
  const result = evaluateQuotaStatus({
    limits: { ...baseLimits },
    todayUsage: { smsOutbound: 200, aiCalls: 10, leadsCreated: 3 },
    monthlyUsage: { smsOutbound: 1000, aiCalls: 100, leadsCreated: 20 },
    pending: { smsOutbound: 1 },
  });

  assert.equal(result.exceeded, true);
  assert.equal(result.reason, "daily_sms_limit");
  assert.equal(result.current, 201);
});

test("blocks usage that would exceed a monthly AI limit", () => {
  const result = evaluateQuotaStatus({
    limits: { ...baseLimits, monthlyAiLimit: 10 },
    todayUsage: { smsOutbound: 10, aiCalls: 2, leadsCreated: 1 },
    monthlyUsage: { smsOutbound: 100, aiCalls: 10, leadsCreated: 20 },
    pending: { aiCalls: 1 },
  });

  assert.equal(result.exceeded, true);
  assert.equal(result.reason, "monthly_ai_limit");
  assert.equal(result.current, 11);
});

test("blocks inactive accounts immediately", () => {
  const result = evaluateQuotaStatus({
    limits: { ...baseLimits, isActive: false },
    todayUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 0 },
    monthlyUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 0 },
  });

  assert.equal(result.exceeded, true);
  assert.equal(result.reason, "account_disabled");
});

test("AI quota exhaustion does not consume the separate SMS handoff budget", () => {
  const limits = {
    monthlySmslimit: 100,
    monthlyAiLimit: 0,
    monthlyLeadLimit: 100,
    dailySmsLimit: 100,
    dailyAiLimit: 0,
    dailyLeadLimit: 100,
    isActive: true,
  };
  assert.equal(
    evaluateQuotaStatus({
      limits,
      todayUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 1 },
      monthlyUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 1 },
      pending: { smsOutbound: 1 },
    }).exceeded,
    false,
  );
  assert.equal(
    evaluateQuotaStatus({
      limits,
      todayUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 1 },
      monthlyUsage: { smsOutbound: 0, aiCalls: 0, leadsCreated: 1 },
      pending: { aiCalls: 1 },
    }).exceeded,
    true,
  );
});
