"use client";

import { Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n/context";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-between gap-3 border-t px-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{t("sidebar.darkMode")}</span>
        </div>
        <div className="h-6 w-11 shrink-0 rounded-full bg-muted" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 pt-4">
      <div className="flex min-w-0 items-center gap-2">
        <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Label htmlFor="theme-dark" className="cursor-pointer text-sm font-medium leading-none">
          {t("sidebar.darkMode")}
        </Label>
      </div>
      <Switch
        id="theme-dark"
        checked={resolvedTheme === "dark"}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={t("sidebar.toggleDarkMode")}
      />
    </div>
  );
}
