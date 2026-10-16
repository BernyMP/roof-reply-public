"use client";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { PageHeading } from "@/components/dashboard/page-heading";
import { LeadsTable } from "@/components/dashboard/leads-table";
export default function LeadsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const completed = useQuery(
    api.users.hasCompletedOnboarding,
    user ? { clerkId: user.id } : "skip",
  );
  useEffect(() => {
    if (isLoaded && !user) router.replace("/");
    else if (completed === false) router.replace("/onboarding");
  }, [isLoaded, user, completed, router]);
  if (!user || !completed) return <DashboardLoading label="Loading leads" />;
  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap space-y-6">
        <PageHeading
          title="Leads"
          description="Review inquiries and plan your next follow-up."
        />
        <Suspense fallback={<p>Loading inbox…</p>}>
          <LeadsTable />
        </Suspense>
      </div>
    </div>
  );
}
