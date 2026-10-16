import { attributionValidator, followUpReceiptValidator } from "./leadCaptureValidators";
import { assessmentSnapshotValidator } from "./leadMagnetValidators";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { eventStatus, deliveryStatus } from "./pilotValidators";
import { socialContent, socialDelivery, socialQualityScores } from "./socialValidators";
import { contactPreference, checklistItem } from "./conciergeValidators";

export default defineSchema({
  socialAgentWorkers: defineTable({ workerId: v.string(), lastSeenAt: v.number(), state: v.string(), error: v.optional(v.string()), activeRunId: v.optional(v.id("socialAgentRuns")), verifiedAt: v.optional(v.number()), verifiedModel: v.optional(v.string()) }).index("by_worker", ["workerId"]),
  socialAgentSettings: defineTable({ executionMode: v.optional(v.union(v.literal("hosted"), v.literal("local-chatgpt"))), workerId: v.optional(v.string()), key: v.string(), mode: v.string(), cutoverAt: v.optional(v.number()), trialAccepted: v.boolean(), updatedAt: v.number(), experimentStartedAt: v.optional(v.number()), experimentEndsAt: v.optional(v.number()), experimentBudgetUsd: v.optional(v.number()), postsPerDay: v.optional(v.number()) }).index("by_key", ["key"]),
  socialAgentRuns: defineTable({
    requestId: v.string(), assignmentId: v.optional(v.id("socialPosts")), previousAssignmentId: v.optional(v.id("socialPosts")), date: v.string(), slot: v.union(v.literal("morning"), v.literal("afternoon")), mode: v.union(v.literal("preview"), v.literal("publish")),
    executionMode: v.optional(v.union(v.literal("hosted"), v.literal("local-chatgpt"))), workerId: v.optional(v.string()), claimHash: v.optional(v.string()), workerFinishedAt: v.optional(v.number()), editorialVersion: v.optional(v.string()), creativeBrief: v.optional(v.any()), sourceVersion: v.string(), status: v.string(), version: v.number(), eveRunId: v.optional(v.string()), dispatchUntil: v.optional(v.number()), error: v.optional(v.string()), trial: v.boolean(),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_request", ["requestId"]).index("by_assignment", ["assignmentId"]).index("by_created", ["createdAt"]),
  socialAgentDrafts: defineTable({ runId: v.id("socialAgentRuns"), version: v.number(), content: socialContent, imageId: v.id("_storage"), imageHash: v.string(), review: v.optional(v.object({ approved: v.boolean(), reason: v.string(), sessionId: v.string(), scores: v.optional(socialQualityScores), checks: v.optional(v.any()) })), inspectedBy: v.optional(v.string()), createdAt: v.number() }).index("by_run", ["runId", "version"]),
  socialAgentPreferences: defineTable({ version: v.number(), runId: v.id("socialAgentRuns"), tone: v.string(), preferredTopics: v.array(v.string()), evidenceKey: v.string(), createdAt: v.number() }).index("by_version", ["version"]).index("by_evidence", ["evidenceKey"]),
  socialAgentFeedback: defineTable({ runId: v.optional(v.id("socialAgentRuns")), text: v.string(), operator: v.string(), createdAt: v.number() }).index("by_created", ["createdAt"]),
  socialAgentResearch: defineTable({ date: v.string(), key: v.string(), kind: v.string(), data: v.any(), createdAt: v.number() }).index("by_date", ["date"]).index("by_key", ["key"]),
  socialAgentUsage: defineTable({ billing: v.optional(v.literal("chatgpt-subscription")), role: v.optional(v.string()), model: v.optional(v.string()), inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()), key: v.string(), runId: v.id("socialAgentRuns"), category: v.string(), month: v.string(), reservedUsd: v.number(), finalization: v.optional(v.boolean()), notBefore: v.optional(v.number()), actualUsd: v.optional(v.number()), createdAt: v.number() }).index("by_key", ["key"]).index("by_month", ["month", "category"]).index("by_run", ["runId"]),
  socialAgentEvents: defineTable({ runId: v.id("socialAgentRuns"), key: v.string(), kind: v.string(), summary: v.string(), createdAt: v.number() }).index("by_key", ["key"]).index("by_run", ["runId"]),
  socialAgentMetrics: defineTable({ postId: v.id("socialPosts"), platform: v.string(), metrics: v.any(), fetchedAt: v.number(), metricsUpdatedAt: v.optional(v.string()) }).index("by_post", ["postId", "platform"]),
  socialAgentInsights: defineTable({ week: v.string(), text: v.string(), sampleSize: v.number(), createdAt: v.number() }).index("by_week", ["week"]),
  socialPosts: defineTable({
    slot: v.optional(v.union(v.literal("morning"), v.literal("afternoon"))), engine: v.optional(v.literal("eve")),
    date: v.string(), dueAt: v.number(), sourceVersion: v.string(), configRevision: v.string(),
    organizationId: v.string(), facebookChannelId: v.string(), instagramChannelId: v.string(),
    content: v.optional(socialContent), imageId: v.optional(v.id("_storage")), generationAttempts: v.number(),
    facebook: socialDelivery, instagram: socialDelivery,
    open: v.boolean(), cancelRequested: v.boolean(), error: v.optional(v.string()),
    nextCheckAt: v.number(), leaseToken: v.optional(v.string()), leaseUntil: v.number(),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_date_slot", ["date", "slot"]).index("by_date", ["date"]).index("by_due", ["dueAt"]).index("by_work", ["open", "nextCheckAt"]),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    onboardingStep: v.number(), // Current step (0-7)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  onboardingConcierge: defineTable({
    clerkId: v.string(),
    userId: v.id("users"),
    contactPreference,
    enrolledAt: v.number(),
    followUpDueAt: v.number(),
    emailContactedAt: v.optional(v.number()),
    smsContactedAt: v.optional(v.number()),
    emailContactedBy: v.optional(v.string()),
    smsContactedBy: v.optional(v.string()),
    kickoffAt: v.optional(v.number()),
    nextAction: v.string(),
    nextActionOwner: v.union(v.literal("berny"), v.literal("customer")),
    checklist: v.array(checklistItem),
    privateNotes: v.string(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]).index("by_due", ["followUpDueAt"]),

  // Legacy empty tables retained by the dev deployment.
  // They are not used by current app code, but declaring them avoids
  // schema-less app tables in Convex until they are removed from the deployment.
  tenants: defineTable({}),
  telnyx_numbers: defineTable({}),
  conversations: defineTable({}),
  webhook_events: defineTable({}),

  onboarding: defineTable({
    userId: v.id("users"),
    clerkId: v.string(),

    activationMode: v.optional(v.union(v.literal("paused"), v.literal("rehearsal"), v.literal("live"))),
    provisioningStatus: v.optional(v.union(v.literal("pending"),v.literal("ready"),v.literal("failed"))),
    messagingProfileId: v.optional(v.string()), voiceApplicationId: v.optional(v.string()),
    providerEvidence: v.optional(v.string()), forwardingEvidence: v.optional(v.string()), rehearsalEvidence: v.optional(v.string()),
    keywordHandling: v.optional(v.union(v.literal("telnyx"),v.literal("application"))),
    evidenceUpdatedAt: v.optional(v.number()), evidenceUpdatedBy: v.optional(v.string()),
    assignmentToken: v.optional(v.string()), isDemoAccount: v.optional(v.boolean()),
    // Step 1: Dream Outcome
    dreamOutcome: v.optional(v.string()),

    // Step 3: Booking Machine Configuration
    bookingDeliveryMethod: v.optional(
      v.union(
        v.literal("phone"),
        v.literal("email"),
        v.literal("crm"),
        v.literal("google_sheet")
      )
    ),
    bookingDeliveryPhone: v.optional(v.string()),
    accountSmsConsentGranted: v.optional(v.boolean()),
    accountSmsConsentAt: v.optional(v.number()),
    accountSmsConsentPhone: v.optional(v.string()),
    accountSmsConsentText: v.optional(v.string()),
    accountSmsConsentVersion: v.optional(v.string()),
    bookingDeliveryEmail: v.optional(v.string()),
    bookingDeliveryCrm: v.optional(v.string()),
    bookingDeliveryGoogleSheet: v.optional(v.string()),
    leadHandoffMode: v.optional(
      v.union(
        v.literal("review_first"),
        v.literal("booking_link"),
        v.literal("review_and_booking"),
        v.literal("emergency_escalation")
      )
    ),
    bookingLink: v.optional(v.string()),
    bookingLinkLabel: v.optional(v.string()),
    autoBookingJobTypes: v.optional(v.array(v.string())),
    handoffInstructions: v.optional(v.string()),

    // Service Areas
    serviceAreas: v.optional(
      v.array(
        v.object({
          type: v.union(
            v.literal("zip"),
            v.literal("city"),
            v.literal("radius")
          ),
          value: v.string(),
        })
      )
    ),

    // Job Types
    preferredJobTypes: v.optional(
      v.array(
        v.union(
          v.literal("leak_repairs"),
          v.literal("storm_damage"),
          v.literal("emergency_tarping"),
          v.literal("tile_shingle"),
          v.literal("insurance_jobs")
        )
      )
    ),
    filteredJobTypes: v.optional(v.array(v.string())),

    // Step 3: AI Behavior
    aiTone: v.optional(
      v.union(
        v.literal("professional"),
        v.literal("friendly"),
        v.literal("straight_to_point"),
        v.literal("bilingual"),
        v.literal("custom")
      )
    ),
    typicalCallDescription: v.optional(v.string()),
    callApproach: v.optional(v.string()),
    thingsNotToSay: v.optional(v.string()),
    autoBookCalendar: v.optional(v.boolean()),
    calendarAvailability: v.optional(v.string()),
    sameDayRules: v.optional(v.string()),
    emergencyEscalation: v.optional(v.string()),
    collectPhotosFirst: v.optional(v.boolean()),

    // Step 3: Performance Framework
    minimumServiceFee: v.optional(v.number()),
    currentMonthlyJobVolume: v.optional(v.number()),
    first30DaysGoal: v.optional(v.string()),

    // Step 4: Compliance
    legalBusinessName: v.optional(v.string()),
    ein: v.optional(v.string()),
    businessAddress: v.optional(v.string()),
    businessCity: v.optional(v.string()),
    businessState: v.optional(v.string()),
    businessZip: v.optional(v.string()),
    website: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    ownerPhone: v.optional(v.string()),
    businessPhone: v.optional(v.string()),
    verificationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),

    // Telnyx Phone Number (provisioned for this user)
    telnyxPhoneNumber: v.optional(v.string()),
    telnyxPhoneNumberId: v.optional(v.string()),
    telnyxProvisionedAt: v.optional(v.number()),

    // 10DLC Campaign Compliance
    campaignId: v.optional(v.string()), // Telnyx campaign ID
    campaignStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
    campaignSubmittedAt: v.optional(v.number()),
    campaignApprovedAt: v.optional(v.number()),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_telnyx_phone", ["telnyxPhoneNumber"]),

  demoSessions: defineTable({
    clerkId: v.string(), operatorId: v.string(), sender: v.string(), recipient: v.string(),
    businessName: v.string(), consentReference: v.string(),
    state: v.union(v.literal("active"),v.literal("completed"),v.literal("resetting"),v.literal("archived")),
    leadId: v.optional(v.id("leads")),
    bookingEnabled: v.boolean(), bookingLink: v.optional(v.string()), bookingLinkLabel: v.optional(v.string()),
    eventDemo: v.optional(v.boolean()), day: v.optional(v.string()),
    messageCount: v.optional(v.number()), outboundCount: v.optional(v.number()), aiCallCount: v.optional(v.number()),
    terminationReason: v.optional(v.string()), lastActivityAt: v.optional(v.number()),
    createdAt: v.number(), updatedAt: v.number(), archivedAt: v.optional(v.number()),
  }).index("by_pair",["sender","recipient","createdAt"]).index("by_account",["clerkId","createdAt"]),

  eventDemoDays: defineTable({
    day: v.string(), participants: v.number(), attempts: v.number(), reservedCents: v.number(),
  }).index("by_day", ["day"]),
  eventDemoParticipants: defineTable({
    day: v.string(), phone: v.string(), attempts: v.number(), lastStartAt: v.number(),
  }).index("by_day_phone", ["day", "phone"]),
  eventDemoRequests: defineTable({
    key: v.string(), phone: v.string(), sessionId: v.id("demoSessions"), createdAt: v.number(),
  }).index("by_key", ["key"]),
  eventDemoCosts: defineTable({
    key: v.string(), day: v.string(), sessionId: v.id("demoSessions"),
    kind: v.union(v.literal("sms"), v.literal("ai")), cents: v.number(), createdAt: v.number(),
  }).index("by_key", ["key"]).index("by_day", ["day"]),

  // Leads captured from missed calls/SMS
  leads: defineTable({
    userId: v.id("users"),
    clerkId: v.string(),

    sampleKey: v.optional(v.string()),
    demoSessionId: v.optional(v.id("demoSessions")),
    // Lead contact info
    phoneNumber: v.string(),
    name: v.optional(v.string()),

    // Lead details captured from conversation
    jobType: v.optional(v.string()),
    location: v.optional(v.string()),
    urgency: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    summary: v.optional(v.string()),

    // Status tracking
    status: v.union(
      v.literal("new"),
      v.literal("qualifying"),
      v.literal("qualified"),
      v.literal("not_qualified"),
      v.literal("needs_followup"),
      v.literal("booking_link_sent"),
      v.literal("needs_contractor_review"),
      v.literal("appointment_booked")
    ),
    channel: v.union(v.literal("call"), v.literal("sms")),

    // Notification status
    userNotified: v.boolean(),
    notifiedAt: v.optional(v.number()),
    handoffModeUsed: v.optional(v.string()),
    bookingLinkSentAt: v.optional(v.number()),
    bookingUrlSent: v.optional(v.string()),
    contractorReviewSentAt: v.optional(v.number()),
    handoffReason: v.optional(v.string()),
    appointmentStart: v.optional(v.number()),
    appointmentEnd: v.optional(v.number()),
    appointmentEventUri: v.optional(v.string()),

    // AI conversation tracking
    aiResponseCount: v.optional(v.number()),
    conversationEnded: v.optional(v.boolean()),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_phone", ["phoneNumber"])
    .index("by_account_phone", ["clerkId","phoneNumber"])
    .index("by_status", ["status"]),

  automationEvents: defineTable({
    demoSessionId: v.optional(v.id("demoSessions")),
    eventId: v.string(), conversationKey: v.string(), clerkId: v.optional(v.string()),
    type: v.string(), sender: v.string(), recipient: v.string(), providerId: v.string(),
    text: v.string(), occurredAt: v.number(), receivedAt: v.number(),
    status: eventStatus, attempts: v.number(), startedAt: v.optional(v.number()), plannedAt:v.optional(v.number()), nextAttemptAt:v.optional(v.number()),
    demoInboundCounted: v.optional(v.boolean()),
    error: v.optional(v.string()), leadId: v.optional(v.id("leads")),
  }).index("by_event", ["eventId"]).index("by_conversation", ["conversationKey", "receivedAt"])
    .index("by_session", ["demoSessionId"]).index("by_status", ["status"]).index("by_account", ["clerkId"]).index("by_provider",["providerId"]).index("by_conversation_status",["conversationKey","status","receivedAt"]),
  outboundMessages: defineTable({
    demoSessionId: v.optional(v.id("demoSessions")),
    key: v.string(), eventId: v.id("automationEvents"), clerkId: v.string(),
    leadId: v.optional(v.id("leads")), from: v.string(), to: v.string(), text: v.string(),
    purpose: v.union(v.literal("reply"),v.literal("booking"),v.literal("owner"),v.literal("keyword"),v.literal("test")),
    state: deliveryStatus, providerId: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
    receiptAt: v.optional(v.number()), error: v.optional(v.string()),
  }).index("by_lead",["leadId"]).index("by_session",["demoSessionId"]).index("by_key",["key"]).index("by_event",["eventId"]).index("by_provider",["providerId"]).index("by_account",["clerkId"]).index("by_state",["state"]),
  deliveryReceipts: defineTable({ providerId:v.string(), status:v.string(), occurredAt:v.number() }).index("by_provider",["providerId"]),
  smsPreferences: defineTable({sender:v.string(),recipient:v.string(),blocked:v.boolean(),updatedAt:v.number()}).index("by_pair",["sender","recipient"]),
  // Conversation messages with leads
  messages: defineTable({
    leadId: v.id("leads"),
    userId: v.id("users"),

    // Message content
    sender: v.union(v.literal("lead"), v.literal("ai")),
    content: v.string(),

    // Telnyx message tracking
    telnyxMessageId: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_lead_id", ["leadId"])
    .index("by_telnyx_id", ["telnyxMessageId"]),

  // SMS Opt-out tracking (10DLC compliance)
  // Tracks phone numbers that have opted out - respected globally
  optOuts: defineTable({
    phoneNumber: v.string(), // The phone number that opted out
    optedOutAt: v.number(),
    // Which RoofReply number they opted out from (for reference)
    telnyxPhoneNumber: v.optional(v.string()),
  }).index("by_phone", ["phoneNumber"]),

  // Usage tracking for cost control and rate limiting
  usageTracking: defineTable({
    clerkId: v.string(),
    date: v.string(), // YYYY-MM-DD format for daily tracking

    // SMS usage
    smsOutbound: v.number(), // Number of SMS sent
    smsInbound: v.number(), // Number of SMS received

    // AI usage
    aiCalls: v.number(), // Number of OpenAI API calls
    aiTokensUsed: v.number(), // Total tokens consumed (estimated)

    // Lead usage
    leadsCreated: v.number(), // New leads created
    missedCallsSms: v.number(), // SMS sent for missed calls

    // Owner notifications
    ownerNotifications: v.number(), // SMS sent to business owner

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_date", ["date"])
    .index("by_clerk_and_date", ["clerkId", "date"]),

  // Rate limiting for webhook protection
  rateLimits: defineTable({
    key: v.string(), // e.g., "missed_call:{phoneNumber}" or "webhook:{ip}"
    count: v.number(),
    windowStart: v.number(), // Timestamp when window started
    expiresAt: v.number(), // When this record can be cleaned up
  }).index("by_key", ["key"]),

  // Global usage quotas (admin-configurable)
  usageQuotas: defineTable({
    clerkId: v.string(),
    // Monthly limits
    monthlySmslimit: v.number(), // Max SMS per month (default: 2000)
    monthlyAiLimit: v.number(), // Max AI calls per month (default: 2000)
    monthlyLeadLimit: v.number(), // Max leads per month (default: 500)
    // Daily limits (circuit breakers)
    dailySmsLimit: v.number(), // Max SMS per day (default: 200)
    dailyAiLimit: v.number(), // Max AI calls per day (default: 100)
    dailyLeadLimit: v.number(), // Max leads per day (default: 50)
    // Status
    isActive: v.boolean(),
    quotaExceededAt: v.optional(v.number()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Lead magnet calculator leads (public, no auth required)
  leadMagnetLeads: defineTable({
    originalAttribution: v.optional(attributionValidator),
    followUpRequest: v.optional(followUpReceiptValidator),
    captureEventId: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    phoneNumber: v.string(),

    // Calculator inputs for reference
    averageJobValue: v.optional(v.number()),
    missedCallsPerWeek: v.optional(v.number()),
    closeRate: v.optional(v.number()),
    realLeadRate: v.optional(v.number()),
    engagementRate: v.optional(v.number()),
    qualificationRate: v.optional(v.number()),

    // Calculated results
    monthlyRecovery: v.optional(v.number()),
    yearlyRecovery: v.optional(v.number()),
    calculationVersion: v.optional(v.literal(2)),
    existingRecoveryRate: v.optional(v.union(v.number(), v.null())),

    latestAssessment: v.optional(assessmentSnapshotValidator),
    assessmentUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_follow_up_requested_at", ["followUpRequest.requestedAt"]),

  // Public RoofReply demo SMS opt-ins for 10DLC consent records
  demoSmsOptIns: defineTable({
    recordId: v.string(),
    type: v.literal("roofreply_demo_sms_opt_in"),
    phoneNumber: v.string(),
    rawPhone: v.string(),
    name: v.union(v.string(), v.null()),
    company: v.union(v.string(), v.null()),
    timestamp: v.string(),
    sourceUrl: v.union(v.string(), v.null()),
    ipAddress: v.union(v.string(), v.null()),
    userAgent: v.union(v.string(), v.null()),
    consentText: v.string(),
    consentVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_record_id", ["recordId"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_phone_created_at", ["phoneNumber", "createdAt"])
    .index("by_ip_created_at", ["ipAddress", "createdAt"])
    .index("by_timestamp", ["timestamp"]),
});
