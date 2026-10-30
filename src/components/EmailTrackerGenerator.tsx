"use client";

import { useState } from "react";
import Link from "next/link";

type TrackingPixel = {
  pixelUrl: string;
  html: string;
};

export default function EmailTrackerGenerator() {
  const [trackingPixel, setTrackingPixel] = useState<TrackingPixel | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  async function generatePixel() {
    setLoading(true);
    setError("");
    setCopied("");

    try {
      const params = new URLSearchParams({
        recipient: "Reusable Gmail template",
        subject: "Email opened",
      });
      const response = await fetch(`/api/track/new?${params.toString()}`, {
        cache: "no-store",
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not generate the tracking image.";
        throw new Error(message);
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("pixelUrl" in result) ||
        typeof result.pixelUrl !== "string" ||
        !("html" in result) ||
        typeof result.html !== "string"
      ) {
        throw new Error("The tracking service returned an invalid response.");
      }

      setTrackingPixel({ pixelUrl: result.pixelUrl, html: result.html });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not generate the tracking image.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    setError("");
    setCopied("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied.`);
    } catch {
      setError("Clipboard access failed. Select and copy the text instead.");
    }
  }

  async function sendTestNotification() {
    setTesting(true);
    setError("");
    setCopied("");

    try {
      const response = await fetch("/api/track/test", {
        method: "POST",
        cache: "no-store",
      });
      const result: unknown = await response.json();
      const message =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : null;

      if (!response.ok) {
        const errorMessage =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not send the test notification.";
        throw new Error(errorMessage);
      }

      setCopied(message ?? "Resend accepted the test email for delivery.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send the test notification.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-surface">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <Link
            href="/employee"
            className="font-headline font-extrabold text-on-surface hover:text-primary"
          >
            Employee Portal
          </Link>
          <Link
            href="/employee"
            className="text-sm font-semibold text-on-surface-variant hover:text-primary"
          >
            Back to applications
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-14 sm:py-20">
        <span className="text-primary font-bold tracking-widest uppercase text-xs block mb-3">
          Gmail helper
        </span>
        <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface mb-4">
          Reusable email-open tracker
        </h1>
        <p className="text-on-surface-variant leading-relaxed max-w-2xl mb-8">
          Generate one tracking image and add it to a Gmail template. When the
          image loads, an alert is sent to projects@renewlighting.com.
        </p>

        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 sm:p-8 editorial-shadow">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-3">
            Create your reusable tracking image
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            Generate the image once, then add its URL to your Gmail template.
            The notification will use the same generic label for every email
            sent with that template; it cannot tell which recipient opened it.
          </p>

          <button
            type="button"
            onClick={generatePixel}
            disabled={loading}
            className="primary-gradient text-on-primary px-6 py-3 rounded-full font-headline font-bold text-sm disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate tracking image"}
          </button>
          <button
            type="button"
            onClick={sendTestNotification}
            disabled={testing}
            className="ml-3 border border-outline-variant/40 bg-surface-container-lowest text-on-surface px-6 py-3 rounded-full font-headline font-bold text-sm disabled:opacity-60"
          >
            {testing ? "Sending test..." : "Send test notification"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          )}
          {copied && (
            <p role="status" className="mt-5 text-sm font-medium text-primary">
              {copied}
            </p>
          )}

          {trackingPixel && (
            <div className="mt-8 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label
                    htmlFor="pixel-url"
                    className="text-sm font-bold text-on-surface"
                  >
                    Tracking image URL
                  </label>
                  <button
                    type="button"
                    onClick={() => copy(trackingPixel.pixelUrl, "Image URL")}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Copy URL
                  </button>
                </div>
                <textarea
                  id="pixel-url"
                  readOnly
                  rows={3}
                  value={trackingPixel.pixelUrl}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 text-xs text-on-surface"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label
                    htmlFor="pixel-html"
                    className="text-sm font-bold text-on-surface"
                  >
                    HTML snippet
                  </label>
                  <button
                    type="button"
                    onClick={() => copy(trackingPixel.html, "HTML snippet")}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Copy HTML
                  </button>
                </div>
                <textarea
                  id="pixel-html"
                  readOnly
                  rows={3}
                  value={trackingPixel.html}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 text-xs text-on-surface"
                />
              </div>

              <div className="rounded-xl bg-surface-container-low p-5 text-sm text-on-surface-variant leading-relaxed">
                <h3 className="font-bold text-on-surface mb-2">Add it to Gmail</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>In Gmail, open Settings and enable Templates.</li>
                  <li>
                    Compose the email template, then use Insert photo and choose
                    Web address (URL).
                  </li>
                  <li>
                    Paste the tracking image URL above and insert the 1×1 image.
                  </li>
                  <li>Use More options → Templates to save the message as a template.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-on-surface-variant leading-relaxed">
          Open tracking depends on images loading. Gmail and other email
          services may proxy, cache, or block images, so notifications can be
          delayed or missing and may not correspond to a person reading the
          message.
        </p>
      </section>
    </main>
  );
}
