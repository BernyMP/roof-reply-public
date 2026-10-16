// Customer-facing content only. Keep the editorial Markdown and this module in sync.
// Never import the internal launch appendix into a public bundle.
export type KitBlock =
  | { type: "paragraph" | "heading" | "quote"; text: string }
  | { type: "list"; ordered: boolean; items: readonly string[] }
  | { type: "table"; headers: readonly string[]; rows: readonly (readonly string[])[] }
  | { type: "columns" };
export interface KitSection { id: string; title: string; blocks: readonly KitBlock[] }
export const KIT_VERSION = "rescue_kit_v1" as const;
export const KIT_TITLE = "The Roofing Missed-Call Rescue Kit";
export const KIT_PROMISE = "Know who calls back, what to say, and how to keep missed roofing inquiries from slipping through the cracks.";
export const KIT_PDF_URL = "/downloads/roofreply-missed-call-rescue-kit.pdf";
export const KIT_CSV_URL = "/downloads/roofreply-missed-call-tracking-sheet.csv";
export const TRACKING_COLUMNS = ["Inquiry reference", "First missed call", "Classification / prior contact", "Owner", "Callback attempts", "Two-way contact", "Next action", "Due", "Outcome / inspection status"] as const;
export function trackingCsv(): string {
  return "\uFEFF" + TRACKING_COLUMNS.map((cell) => `"${cell.replaceAll('"', '\"\"')}"`).join(",") + "\r\n";
}
export const KIT_SECTIONS: readonly KitSection[] = [
  {
    "id": "introduction",
    "title": "A routine your office can use",
    "blocks": [
      {
        "type": "paragraph",
        "text": "A practical office routine for roofing owners and the people handling incoming calls. Use your existing phone, call log, and spreadsheet. The complete kit is free to use; no account, email address, or booking is required."
      }
    ]
  },
  {
    "id": "start",
    "title": "Start here: give the next missed inquiry an owner",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Choose one person to review the missed-call list at the next staffed opening. Give them a backup. For each inquiry, record **who owns it and what happens next, by when**. If no further action is needed, record why."
      },
      {
        "type": "paragraph",
        "text": "This kit gives you the plan, words, and tracking sheet to do that. It cannot make a homeowner answer or create coverage when nobody is working."
      },
      {
        "type": "paragraph",
        "text": "Have your business call log, current callback process, and staff availability nearby. Fill in the blanks below with arrangements your team can actually keep. Keep homeowner contact details in your existing private records; nothing needs to be uploaded or sent to RoofReply."
      }
    ]
  },
  {
    "id": "office-plan",
    "title": "1. Set the office follow-up plan",
    "blocks": [
      {
        "type": "table",
        "headers": [
          "Decision",
          "Your team's answer"
        ],
        "rows": [
          [
            "Person responsible for the missed-call queue",
            "[Name / role]"
          ],
          [
            "Backup when that person is unavailable",
            "[Name / role]"
          ],
          [
            "Staffed callback days and hours, including time zone",
            "[Days, hours, time zone]"
          ],
          [
            "Where the team checks missed calls and existing conversations",
            "[Existing call log / inbox / system]"
          ],
          [
            "Where the tracking sheet lives",
            "[Shared location your team can access]"
          ],
          [
            "Queue checks during staffed hours",
            "[Specific times or existing review routine]"
          ],
          [
            "After-hours review",
            "[Who checks at the next staffed opening, and when]"
          ],
          [
            "First callback target during staffed hours",
            "[A time your team agrees it can meet]"
          ],
          [
            "Person who can confirm an inspection",
            "[Name / role]"
          ],
          [
            "Person who reviews urgent or uncertain requests",
            "[Name / role and internal contact method]"
          ],
          [
            "End-of-day queue review",
            "[Owner and time]"
          ],
          [
            "Weekly review",
            "[Owner, date and time]"
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "**Before using the plan:** have the owner and backup accept their responsibilities. If neither is available, the business owner must assign someone or record the coverage gap. A name in a table does not create coverage."
      },
      {
        "type": "heading",
        "text": "Run this routine at each queue check"
      },
      {
        "type": "list",
        "ordered": true,
        "items": [
          "**Find the inquiry.** Check the existing record for prior contact and repeat calls. Keep repeat attempts for the same inquiry together so two people do not call it back independently.",
          "**Classify what you know.** Use new roofing inquiry, existing-customer issue, vendor/spam, or unknown. A number without enough context stays unknown until checked. Route existing customers to the right teammate; they still need service even though they are not new opportunities.",
          "**Assign an owner.** Write the person's name, next action, and due time. The backup takes over explicitly when needed. If someone already reached the homeowner, continue the agreed next step instead of restarting the conversation.",
          "**Return the call.** Use your existing permitted callback process and the scripts below. Record an unanswered attempt separately from a two-way conversation.",
          "**Set the next step.** After a conversation, record the roofing need, service-area fit, requested timing, responsible teammate, and next action. An inspection stays requested until your team confirms it with the homeowner.",
          "**Review the open queue.** At the end of each staffed day, resolve unassigned and overdue items. Complete the action or reassign it with a new due time and reason; keep the original missed deadline visible."
        ]
      },
      {
        "type": "paragraph",
        "text": "**If nobody answers:** record the attempt and any voicemail. Set the next attempt or review time using your existing callback policy and any homeowner preference. If you have no policy, the owner must choose the next step before ending the queue review. “Awaiting reply” still needs an owner and review time; it is not proof of successful contact."
      },
      {
        "type": "paragraph",
        "text": "**If the homeowner declines or asks for no further contact:** record that instruction and close the item accordingly. If no further attempts are appropriate under your process, close it as “not reached,” not as a conversation or sale."
      }
    ]
  },
  {
    "id": "scripts",
    "title": "2. Use these callback and handoff scripts",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Replace the bracketed fields before use. These are manual callback scripts for your existing process."
      },
      {
        "type": "heading",
        "text": "Callback opener"
      },
      {
        "type": "quote",
        "text": "Hi, this is [name] from [roofing business], returning your call. Is now a good time to talk about what you need?"
      },
      {
        "type": "paragraph",
        "text": "If the timing is inconvenient:"
      },
      {
        "type": "quote",
        "text": "What time within [staffed callback hours] would work better? I'll record that for [responsible teammate]."
      },
      {
        "type": "heading",
        "text": "Voicemail"
      },
      {
        "type": "quote",
        "text": "Hi, this is [name] from [roofing business], returning your call. You can reach us at [business number] during [staffed hours]. Thank you."
      },
      {
        "type": "heading",
        "text": "Roofing intake prompts"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "What roofing issue can we help with?",
          "What area is the property in?",
          "Is water coming in now, or is this something you want checked?",
          "When would you like the team to look at it?",
          "What is the best way and time for our team to get back to you?"
        ]
      },
      {
        "type": "paragraph",
        "text": "Record the homeowner's description rather than diagnosing the problem. Keep their address and contact details in your existing private customer record. Pass urgent or uncertain conditions to the designated person; do not promise emergency attendance or roof safety."
      },
      {
        "type": "heading",
        "text": "Close the conversation with a clear next step"
      },
      {
        "type": "quote",
        "text": "I'll pass this to [teammate], who will [next action] by [agreed time]. You've requested [preferred inspection timing]; our team still needs to confirm availability and the appointment with you."
      },
      {
        "type": "paragraph",
        "text": "Use a commitment only after the responsible teammate has accepted it. If you cannot confirm a response time yet, say so and have the office owner assign the internal next action."
      },
      {
        "type": "heading",
        "text": "Handoff to the roofing team"
      },
      {
        "type": "quote",
        "text": "**[Inquiry reference]** — [roofing issue], [service area], [current conditions in the homeowner's words]. Requested timing: [preference]. Contact details: [existing private record reference]. [Teammate] owns [next action] by [date/time]. Inspection status: [requested / awaiting confirmation / contractor-confirmed]."
      },
      {
        "type": "paragraph",
        "text": "Ask the receiving teammate to acknowledge ownership. Keep the original owner responsible until someone accepts the handoff."
      }
    ]
  },
  {
    "id": "tracking-sheet",
    "title": "3. Copy the tracking sheet",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Copy this table into a document, or use its headings as spreadsheet columns. Add one row per unique inquiry. Use your local time zone consistently. Keep repeated calls and attempts in that row or its linked history."
      },
      {
        "type": "table",
        "headers": [
          "Inquiry reference",
          "First missed call",
          "Classification / prior contact",
          "Owner",
          "Callback attempts",
          "Two-way contact",
          "Next action",
          "Due",
          "Outcome / inspection status"
        ],
        "rows": [
          [
            "[Local ID]",
            "[Date/time]",
            "[Type; prior contact yes/no/unknown]",
            "[Name]",
            "[Date/time + result of each attempt]",
            "[Date/time, not reached, or unknown]",
            "[Concrete action, or none + closure reason]",
            "[Date/time or closed]",
            "[Open / closed reason; inspection status]"
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "For a spreadsheet, the same headings are available below as tab-separated text. Paste into the first row. Store entries as text where needed; keep source-record references rather than homeowner details in this sheet."
      },
      {
        "type": "columns"
      },
      {
        "type": "paragraph",
        "text": "**Keep these distinctions:**"
      },
      {
        "type": "list",
        "ordered": false,
        "items": [
          "A voicemail or automated acknowledgement is an attempt, not a two-way conversation.",
          "A homeowner requesting Thursday is not a confirmed Thursday inspection.",
          "Unknown history means “unknown”; do not replace it with “no” or zero.",
          "“Closed — not reached,” “closed — declined,” and “closed — handed to existing-customer service” are different outcomes.",
          "Once your teammate accepts an inspection handoff, close the callback task as “handed off” and retain the appointment reference. That does not establish a completed inspection or sold job."
        ]
      }
    ]
  },
  {
    "id": "example",
    "title": "4. Follow one inquiry through the routine",
    "blocks": [
      {
        "type": "paragraph",
        "text": "**Fictional worked example — not a customer result or a RoofReply performance claim.**"
      },
      {
        "type": "paragraph",
        "text": "Juniper Roofing has staffed callbacks Monday–Friday, 8 a.m.–5 p.m. in its local time zone. Alex owns the queue; Morgan is the backup. Their sample checks are at opening, noon, and before closing. These are example staffing choices, not a recommended response-time benchmark."
      },
      {
        "type": "table",
        "headers": [
          "Step",
          "What the office does"
        ],
        "rows": [
          [
            "Monday, 6:40 p.m.",
            "An unanswered call leaves a voicemail about a roof stain. Nobody is staffed to return it that evening; this is an overnight coverage gap."
          ],
          [
            "Tuesday, 8 a.m.",
            "Alex checks the voicemail and existing records. It is a new roofing inquiry with no prior contact found. Alex creates JR-001, owns the callback, and sets an 8:30 a.m. due time."
          ],
          [
            "Tuesday, 8:15 a.m.",
            "Alex calls using the opener. No answer; Alex leaves the voicemail script and logs the attempt. The callback task was attempted on time, but two-way contact is still “not reached.” Alex sets a noon review under the office's chosen policy."
          ],
          [
            "Tuesday, 10:20 a.m.",
            "The homeowner calls back. Alex uses the intake prompts: ceiling stain after rain, north service area, no water coming in now, Thursday preferred. Alex records the conversation and keeps private contact details in the existing customer record."
          ],
          [
            "Tuesday, 10:25 a.m.",
            "Morgan accepts the handoff: check inspection availability and contact the homeowner by noon. Status: Thursday requested, awaiting confirmation."
          ],
          [
            "Tuesday, 11 a.m.",
            "Morgan agrees a Thursday 9 a.m. inspection with the homeowner and records the appointment. The callback task closes as handed off to Morgan; inspection status becomes contractor-confirmed. No sale or completed inspection is assumed."
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "**The resulting row:**"
      },
      {
        "type": "table",
        "headers": [
          "Inquiry reference",
          "First missed call",
          "Classification / prior contact",
          "Owner",
          "Callback attempts",
          "Two-way contact",
          "Next action",
          "Due",
          "Outcome / inspection status"
        ],
        "rows": [
          [
            "JR-001",
            "Monday 6:40 p.m.",
            "New roofing inquiry; no prior contact found at first review",
            "Morgan; accepted from Alex Tuesday 10:25 a.m.",
            "Tuesday 8:15 a.m.: voicemail; Tuesday 11 a.m.: appointment confirmation",
            "Tuesday 10:20 a.m.: homeowner returned call",
            "None in callback queue; inspection tracked in existing appointment record",
            "Callback task closed Tuesday 11 a.m.",
            "Handed off; Thursday 9 a.m. inspection contractor-confirmed"
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "At the end-of-day check, Alex verifies the accepted handoff and appointment reference. At the weekly review, the team counts one unique eligible inquiry, one with documented follow-up, one reached, and one confirmed inspection. It also retains the overnight coverage gap. One successful callback does not show that all after-hours callers will wait."
      }
    ]
  },
  {
    "id": "weekly-review",
    "title": "5. Use the routine, then review seven days",
    "blocks": [
      {
        "type": "paragraph",
        "text": "**Review period:** [start date] through [end date], in [time zone]. Include seven consecutive calendar days and note which were staffed. Pick a review cutoff time so everyone counts the same records."
      },
      {
        "type": "table",
        "headers": [
          "When",
          "What to do"
        ],
        "rows": [
          [
            "Day 1",
            "Agree ownership, backup, staffed hours, and queue checks. Copy the sheet and rehearse with the fictional example."
          ],
          [
            "Days 2–6",
            "Apply the routine to actual missed inquiries. Review unassigned, overdue, and awaiting-reply items at each staffed day's closing check. Keep after-hours gaps visible."
          ],
          [
            "Day 7",
            "Review records from the chosen period. If the office is closed, conduct the review at the next staffed opening and retain the original period dates. Choose one improvement and a date to check it."
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "Count unique new roofing inquiries first missed during the period, using outcomes known by the review cutoff. Keep older backlog separate. Deduplicate repeat callers about the same inquiry. Separate existing-customer calls, vendors/spam, and unknown classifications; do not treat every missed call as a sales opportunity."
      },
      {
        "type": "table",
        "headers": [
          "Review question",
          "Your count / finding"
        ],
        "rows": [
          [
            "Unique eligible new roofing inquiries missed in the period",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries with an assigned owner",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries with documented follow-up",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries with a two-way conversation, including returned calls",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries with contractor-confirmed inspections",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries still unassigned",
            "[Count / unknown]"
          ],
          [
            "Eligible inquiries with an overdue next action at cutoff",
            "[Count / unknown]"
          ],
          [
            "Calls whose classification or outcome remains unknown",
            "[Separate counts and what needs checking]"
          ],
          [
            "Coverage windows nobody could staff",
            "[Days / times]"
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "Counts can overlap: an inquiry can be both reached and awaiting an overdue next action. Record missing outcomes explicitly. If eligible volume is known to be zero, there was insufficient exposure to judge the routine. If volume or outcomes are unknown, improve the log before drawing conclusions. This review measures follow-up activity and observed outcomes, not lost revenue or proof that the routine caused a booking."
      },
      {
        "type": "heading",
        "text": "Choose the next practical fix"
      },
      {
        "type": "table",
        "headers": [
          "What the records show",
          "What to do next"
        ],
        "rows": [
          [
            "Inquiries have no owner",
            "Assign the queue owner and backup; check assignment at the next staffed opening."
          ],
          [
            "Callbacks happen but next steps stall",
            "Require an accepted handoff and due time; review overdue actions at closing."
          ],
          [
            "Nobody can cover certain hours",
            "Record the gap and agree an honest next staffed callback window; evaluate additional coverage only if the need justifies it."
          ],
          [
            "Outcomes are unknown",
            "Reconcile the call log and private customer records before estimating opportunity."
          ],
          [
            "Inquiries are consistently handled and the workload is manageable",
            "Keep the routine and monitor. An additional service may not add meaningful value."
          ]
        ]
      },
      {
        "type": "paragraph",
        "text": "**Our one change:** [action]. **Owner:** [name]. **Due:** [date/time]. **Check on:** [date]. **Evidence it worked:** [specific change in the call records, such as no unassigned eligible inquiries at closing]."
      }
    ]
  },
  {
    "id": "managed-follow-up",
    "title": "When keeping up is the hard part",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Your team now has a process it can run. If finding someone to keep up with missed calls is still the hard part, book a 20-minute missed-call audit to explore whether RoofReply's managed follow-up fits your business."
      },
      {
        "type": "paragraph",
        "text": "RoofReply installs and manages missed-call text follow-up and gathers roofing details for your team's review. Your team handles inspections and sales. The audit reviews your current coverage and phone setup; fit depends on your workflow and routing capabilities."
      },
      {
        "type": "paragraph",
        "text": "**[Book a 20-minute missed-call audit](https://calendly.com/example/roofing-audit)**"
      },
      {
        "type": "paragraph",
        "text": "If your current process works reliably, keep using it. You do not need to book a call to use any part of this kit."
      }
    ]
  }
];
