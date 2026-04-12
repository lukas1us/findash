"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { translations, type Lang } from "./translations";

const STORAGE_KEY = "findash-lang";

// Dot-path traversal: t("finance.accounts.title") → string
type DeepValue<T> = T extends string ? string : { [K in keyof T]: DeepValue<T[K]> };

function getPath(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : path;
}

// Interpolation helper: i("Hello {name}", { name: "World" }) → "Hello World"
export function i(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "cs",
  setLang: () => {},
  t: (path) => path,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("cs");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === "en" || stored === "cs") {
      setLangState(stored);
      document.documentElement.setAttribute("lang", stored);
    }
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("lang", next);
  }

  function t(path: string): string {
    return getPath(translations[lang], path);
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
