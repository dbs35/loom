"use client";

import { useState, type FormEvent } from "react";

export function AdminPasswordGate() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Login failed");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[420px] border border-rule bg-bg-elev p-8"
      >
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted font-body mb-3">
          Practice Commons admin
        </div>
        <h1 className="font-display text-[28px] font-normal tracking-[-0.01em] m-0 mb-6">
          Sign in
        </h1>
        <label className="block">
          <span className="block text-[11px] tracking-[0.18em] uppercase text-muted font-body mb-2">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoFocus
            required
            className="w-full border border-rule bg-bg p-3 font-body text-[16px] text-ink outline-none focus:border-accent"
          />
        </label>
        {error ? (
          <p className="mt-3 text-[14px] text-accent font-body">{error}</p>
        ) : null}
        <div className="mt-5">
          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full font-body text-[13px] tracking-[0.16em] uppercase px-[22px] py-[14px] bg-ink text-bg-elev border border-ink hover:bg-accent hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Enter"}
          </button>
        </div>
        <p className="mt-6 text-[12px] text-muted font-body">
          MVP-only password gate. There is no real authentication —
          anyone with the password has full edit access.
        </p>
      </form>
    </div>
  );
}
