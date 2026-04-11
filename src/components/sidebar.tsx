"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  Upload,
  Menu,
  X,
  BarChart3,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

const financeLinks = [
  { href: "/finance", label: "Přehled", icon: LayoutDashboard },
  { href: "/finance/transactions", label: "Transakce", icon: ArrowLeftRight },
  { href: "/finance/budgets", label: "Rozpočty", icon: Target },
  { href: "/finance/accounts", label: "Účty", icon: Wallet },
  { href: "/finance/import", label: "Import", icon: Upload },
];

const overviewLinks = [
  { href: "/net-worth", label: "Net Worth", icon: LineChart },
];

const investmentLinks = [
  { href: "/investments", label: "Přehled", icon: TrendingUp },
  { href: "/investments/assets", label: "Aktiva", icon: Package },
  { href: "/investments/purchases", label: "Nákupy", icon: ShoppingCart },
  { href: "/investments/prices", label: "Ceny", icon: DollarSign },
  { href: "/investments/import", label: "Import", icon: Upload },
];

function NavSection({
  title,
  links,
  pathname,
  onLinkClick,
}: {
  title: string;
  links: typeof financeLinks;
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          link.href === pathname ||
          (link.href !== "/finance" && link.href !== "/investments" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col py-6 px-3">
      <div className="flex shrink-0 items-center gap-2 px-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">FinDash</span>
      </div>
      <Separator className="my-6 shrink-0" />
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        <NavSection
          title="Finance"
          links={financeLinks}
          pathname={pathname}
          onLinkClick={() => setMobileOpen(false)}
        />
        <NavSection
          title="Přehled"
          links={overviewLinks}
          pathname={pathname}
          onLinkClick={() => setMobileOpen(false)}
        />
        <NavSection
          title="Investice"
          links={investmentLinks}
          pathname={pathname}
          onLinkClick={() => setMobileOpen(false)}
        />
      </nav>
      <ThemeToggle />
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-card">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 z-40 h-full w-56 bg-card border-r shadow-lg overflow-y-auto">
              {sidebarContent}
            </aside>
          </>
        )}
      </div>
    </>
  );
}
