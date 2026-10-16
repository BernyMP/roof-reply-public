/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as automation from "../automation.js";
import type * as automationActions from "../automationActions.js";
import type * as compliance from "../compliance.js";
import type * as concierge from "../concierge.js";
import type * as conciergeValidators from "../conciergeValidators.js";
import type * as crons from "../crons.js";
import type * as demoSessions from "../demoSessions.js";
import type * as demoSmsConsent from "../demoSmsConsent.js";
import type * as eventDemo from "../eventDemo.js";
import type * as http from "../http.js";
import type * as leadMagnet from "../leadMagnet.js";
import type * as leadMagnetValidators from "../leadMagnetValidators.js";
import type * as leads from "../leads.js";
import type * as onboarding from "../onboarding.js";
import type * as pilot from "../pilot.js";
import type * as pilotValidators from "../pilotValidators.js";
import type * as providerActions from "../providerActions.js";
import type * as social from "../social.js";
import type * as socialActions from "../socialActions.js";
import type * as socialAgent from "../socialAgent.js";
import type * as socialAgentActions from "../socialAgentActions.js";
import type * as socialAgentHttp from "../socialAgentHttp.js";
import type * as socialAgentWorker from "../socialAgentWorker.js";
import type * as socialAgentWorkerAuth from "../socialAgentWorkerAuth.js";
import type * as socialValidators from "../socialValidators.js";
import type * as usageControl from "../usageControl.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  automation: typeof automation;
  automationActions: typeof automationActions;
  compliance: typeof compliance;
  concierge: typeof concierge;
  conciergeValidators: typeof conciergeValidators;
  crons: typeof crons;
  demoSessions: typeof demoSessions;
  demoSmsConsent: typeof demoSmsConsent;
  eventDemo: typeof eventDemo;
  http: typeof http;
  leadMagnet: typeof leadMagnet;
  leadMagnetValidators: typeof leadMagnetValidators;
  leads: typeof leads;
  onboarding: typeof onboarding;
  pilot: typeof pilot;
  pilotValidators: typeof pilotValidators;
  providerActions: typeof providerActions;
  social: typeof social;
  socialActions: typeof socialActions;
  socialAgent: typeof socialAgent;
  socialAgentActions: typeof socialAgentActions;
  socialAgentHttp: typeof socialAgentHttp;
  socialAgentWorker: typeof socialAgentWorker;
  socialAgentWorkerAuth: typeof socialAgentWorkerAuth;
  socialValidators: typeof socialValidators;
  usageControl: typeof usageControl;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
