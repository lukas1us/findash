"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function LanguageToggle() {
  const { lang, setLang } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9" />;
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <button
        onClick={() => setLang("cs")}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          lang === "cs"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Czech"
      >
        CS
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          lang === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
