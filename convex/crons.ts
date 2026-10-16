import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired rate limit records every hour
crons.interval(
  "cleanup expired rate limits",
  { hours: 1 },
  internal.usageControl.cleanupExpiredRateLimitsInternal
);

crons.interval("recover interrupted messaging", { minutes: 1 }, internal.automation.recover);

// Phoenix is UTC-7 year-round: 13:00 UTC = 06:00 Phoenix.
crons.daily("prepare RoofReply social posts", { hourUTC: 13, minuteUTC: 0 }, internal.social.fill);
crons.interval("reconcile RoofReply social posts", { minutes: 15 }, internal.social.maintain);
crons.daily("check social pairs before publication", { hourUTC: 14, minuteUTC: 45 }, internal.social.maintain);
crons.daily("verify social publication", { hourUTC: 15, minuteUTC: 5 }, internal.social.maintain);

// Social-only additions; the customer messaging recovery registration is unchanged.
crons.daily("check afternoon social pairs", { hourUTC: 23, minuteUTC: 15 }, internal.social.maintain);
crons.daily("verify afternoon social publication", { hourUTC: 23, minuteUTC: 35 }, internal.social.maintain);
crons.daily("collect social performance observations", { hourUTC: 0, minuteUTC: 15 }, internal.socialAgentActions.collectMetrics);

export default crons;
