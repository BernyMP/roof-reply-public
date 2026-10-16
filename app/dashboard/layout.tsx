"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  Home,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { ConvexAuthGate } from "@/components/convex-auth-gate";
import { ConvexProvider } from "@/components/convex-provider";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { customerSetupPresentation } from "@/lib/account-presentation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/leads", label: "Leads", icon: MessageSquareText },
  { href: "/dashboard/config", label: "Settings", icon: Settings },
];
function DashboardShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const account = useQuery(
    api.onboarding.getOnboarding,
    user ? { clerkId: user.id } : "skip",
  );
  const ops = useQuery(api.users.hasOpsAccess, user ? {} : "skip");
  const state = customerSetupPresentation(account || {});
  const brand = (
    <Link
      href="/dashboard"
      className="rr-workspace-brand"
      onClick={() => setOpen(false)}
    >
      <Image src="/icon.png" alt="" width={28} height={28} />
      <strong>RoofReply</strong>
    </Link>
  );
  const nav = (
    <nav aria-label="Workspace" className="rr-workspace-nav">
      {navigation.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn("rr-workspace-link", active && "is-active")}
          >
            <item.icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  const help = (
    <div className="space-y-3 border-t border-white/15 pt-5 text-sm">
      <Link
        href="/dashboard/demo"
        className="block text-[#cdd7da] hover:text-white"
        onClick={() => setOpen(false)}
      >
        View guided demo
      </Link>
      <a
        href="mailto:hello@example.com"
        className="block text-[#cdd7da] hover:text-white"
      >
        Contact Berny
      </a>
      {ops && (
        <Link
          href="/dashboard/ops"
          aria-current={pathname === "/dashboard/ops" ? "page" : undefined}
          className="flex items-center gap-2 text-[#cdd7da] hover:text-white"
          onClick={() => setOpen(false)}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          Operator tools
        </Link>
      )}
    </div>
  );
  return (
    <div className="rr-app rr-workspace">
      <a className="rr-skip-link" href="#workspace-content">
        Skip to content
      </a>
      <aside className="rr-workspace-sidebar">
        {brand}
        <p className="rr-workspace-business truncate px-3 text-xs">
          {account?.legalBusinessName || "Your workspace"}
        </p>
        {nav}
        <div className="mt-auto space-y-5 px-3">
          <Link href="/dashboard#setup" className="text-sm">
            {account === undefined ? "Loading…" : state.label}
          </Link>
          {help}
          <div className="flex items-center gap-3">
            <UserButton />
            <span className="truncate text-sm">
              {user?.firstName || "Account"}
            </span>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="rr-mobile-header">
          {brand}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rr-mobile-menu-button">
                <Menu aria-hidden="true" />
                Menu
              </Button>
            </DialogTrigger>
            <DialogContent
              className="rr-navigation-drawer left-0 top-0 flex flex-col h-dvh w-[min(320px,90vw)] translate-x-0 translate-y-0 rounded-none sm:rounded-none"
              aria-describedby={undefined}
            >
              <DialogTitle>Navigation</DialogTitle>
              <div className="self-start">{nav}</div>
              {help}
              <UserButton />
            </DialogContent>
          </Dialog>
        </div>
        <main id="workspace-content" className="min-w-0" tabIndex={-1}>
          {account === undefined ? (
            <DashboardLoading label="Loading account" />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider>
      <ConvexAuthGate>
        <DashboardShell>{children}</DashboardShell>
      </ConvexAuthGate>
    </ConvexProvider>
  );
}
