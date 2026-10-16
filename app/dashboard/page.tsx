"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { PageHeading } from "@/components/dashboard/page-heading";
import { CustomerSetupCard } from "@/components/dashboard/customer-setup-card";
import { ConciergeSetupCard } from "@/components/dashboard/concierge-setup-card";
import { BusinessExample } from "@/components/onboarding/business-example";
import { customerSetupPresentation } from "@/lib/account-presentation";
import {
  leadStatusLabels,
  maskedLeadPhone,
  leadViewUrl,
} from "@/lib/lead-presentation";
export default function DashboardOverviewPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const args = user ? { clerkId: user.id } : "skip";
  const completed = useQuery(api.users.hasCompletedOnboarding, args);
  const account = useQuery(api.onboarding.getOnboarding, args);
  const concierge = useQuery(api.concierge.customerProgress, args);
  const stats = useQuery(api.leads.getLeadStats, args);
  useEffect(() => {
    if (isLoaded && !user) router.replace("/");
    else if (completed === false) router.replace("/onboarding");
  }, [completed, isLoaded, user, router]);
  if (!user || !completed || !account || !stats || concierge === undefined)
    return <DashboardLoading label="Loading overview" />;
  const live = customerSetupPresentation(account).live;
  const settingUp = !!concierge && !live && stats.totalLeads === 0;
  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap space-y-6">
        <PageHeading
          title="Overview"
          description={account.legalBusinessName || "Your roofing business"}
        />
        {concierge ? (
          <ConciergeSetupCard
            concierge={concierge}
            account={account}
            clerkId={user.id}
          />
        ) : (
          <CustomerSetupCard account={account} />
        )}
        {settingUp ? (
          <details className="rr-setup-dashboard-example">
            <summary>What your team will receive</summary>
            <BusinessExample
              businessName={account.legalBusinessName || ""}
              area={account.serviceAreas?.[0]?.value || ""}
            />
          </details>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Needs action", stats.needsActionLeads, "needs_action"],
                ["Total leads", stats.totalLeads, "all"],
              ].map(([label, value, filter]) => (
                <Link
                  key={label}
                  href={leadViewUrl({
                    filter: filter as "all" | "needs_action",
                    page: 1,
                  })}
                  className="rr-app-card p-5"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <strong className="mt-2 block text-3xl font-semibold">
                    {value}
                  </strong>
                  <p className="mt-2 text-xs text-muted-foreground">
                    All time · real inquiries
                  </p>
                </Link>
              ))}
            </div>
            <section className="rr-app-card">
              <h2 className="border-b p-5 text-base font-semibold">
                Recent leads
              </h2>
              {stats.recentLeads.length ? (
                <ul className="divide-y">
                  {stats.recentLeads.map((lead) => (
                    <li key={lead._id}>
                      <Link
                        href={leadViewUrl({
                          filter: "all",
                          page: 1,
                          lead: lead._id,
                        })}
                        className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">
                            {lead.name || maskedLeadPhone(lead.phoneNumber)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {lead.jobType || "Details pending"} ·{" "}
                            {lead.location || "Location not shared"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {leadStatusLabels[lead.status]}
                          </p>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={new Date(lead.createdAt).toISOString()}
                          >
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </time>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8">
                  <p className="font-medium">No customer inquiries yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {live
                      ? "Your service is ready. New missed-call conversations will appear here, and lead alerts will go to your chosen mobile number."
                      : "Once your service is live, missed-call conversations will appear here. We’ll also text lead alerts to your chosen mobile number."}
                  </p>
                  <Link
                    className="rr-text-link mt-4 inline-block"
                    href="/dashboard/demo"
                  >
                    View the guided demo →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
