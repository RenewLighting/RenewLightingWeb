"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signIn, signOut } from "next-auth/react";
import Icon from "@/components/Icon";

export function InventoryLaunchLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Returning via the back button restores this page from cache with the overlay still open.
    const reset = () => setLoading(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <>
      <a href={href} className={className} onClick={() => setLoading(true)}>
        {children}
      </a>
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-sm px-6"
        >
          <div className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-8 text-center editorial-shadow-lg">
            <div className="mx-auto mb-6 h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Opening Warehouse</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Connecting to inventory. If the warehouse has been idle, this can take up to a minute.
            </p>
            <button
              type="button"
              onClick={() => { window.stop(); setLoading(false); }}
              className="mt-6 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Render's free plan sleeps when idle; waking it here hides the cold start.
export function WarmInventory({ origin }: { origin?: string }) {
  useEffect(() => {
    if (!origin) return;
    fetch(`${origin}/healthz`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  }, [origin]);
  return null;
}

export function EmployeeSignIn({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="w-full primary-gradient text-on-primary px-6 py-3.5 rounded-full font-headline font-bold text-sm shadow-[0_4px_16px_rgba(30,109,0,0.25)] hover:shadow-[0_8px_28px_rgba(30,109,0,0.32)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
    >
      <Icon name="login" className="text-xl" />
      Continue with Google
    </button>
  );
}

export function EmployeeSignOut() {
  async function handleSignOut() {
    try {
      await fetch("/api/inventory-logout", { method: "POST" });
    } finally {
      await signOut({ callbackUrl: "/" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
    >
      <Icon name="logout" className="text-lg" />
      Sign out
    </button>
  );
}