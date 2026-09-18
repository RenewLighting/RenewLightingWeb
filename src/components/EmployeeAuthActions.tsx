"use client";

import { signIn, signOut } from "next-auth/react";

export function EmployeeSignIn({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="w-full primary-gradient text-on-primary px-6 py-3.5 rounded-full font-headline font-bold text-sm shadow-[0_4px_16px_rgba(30,109,0,0.25)] hover:shadow-[0_8px_28px_rgba(30,109,0,0.32)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
    >
      <span className="material-symbols-outlined text-xl">login</span>
      Continue with Google
    </button>
  );
}

export function EmployeeSignOut() {
  async function handleSignOut() {
    await fetch("/api/inventory-logout", { method: "POST" });
    await signOut({ callbackUrl: "/" });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
    >
      <span className="material-symbols-outlined text-lg">logout</span>
      Sign out
    </button>
  );
}