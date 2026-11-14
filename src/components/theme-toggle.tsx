"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function getTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const onStorage = (event: StorageEvent) => {
    if (event.key === "pc_theme" || event.key === null) {
      document.documentElement.dataset.theme =
        event.newValue === "dark" ? "dark" : "light";
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

const getServerTheme = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  return (
    <button
      className="theme-toggle"
      aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("pc_theme", next);
        } catch {
          // The control still works when browser storage is unavailable.
        }
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
