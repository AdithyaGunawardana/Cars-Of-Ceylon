"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Phone-width navigation: a "Menu" button that opens a dropdown of the (server-rendered) links in `children`.
// It closes after navigating and on Escape. Desktop shows the links inline instead (see layout.tsx).
export function MobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The layout persists across client-side navigations, so close the menu when the route changes. Adjusting state
  // during render (React's documented pattern for "reset state when a value changes") avoids an effect, and unlike
  // remembering the path it also stays closed when the user comes back to the same page with the Back button.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-[#d3c3c0] px-3 py-1.5 text-xs font-semibold text-[#271310] hover:bg-[#f5f4e8]"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <div
          id="mobile-nav-menu"
          className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 rounded-2xl bg-white p-2 shadow-[0_20px_50px_rgba(27,28,21,0.12)] ring-1 ring-[#d3c3c0]/70"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
