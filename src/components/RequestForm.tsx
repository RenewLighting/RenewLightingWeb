"use client";

import { useState, type FormEvent } from "react";

interface FormData {
    name: string;
    company: string;
    email: string;
    phone: string;
    address: string;
    propertyType: string;
    services: string[];
    details: string;
}

const initialForm: FormData = {
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    propertyType: "",
    services: [],
    details: "",
};

export default function RequestForm() {
    const [form, setForm] = useState<FormData>(initialForm);
    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    function handleServiceToggle(service: string) {
        setForm((prev) => ({
            ...prev,
            services: prev.services.includes(service)
                ? prev.services.filter((s) => s !== service)
                : [...prev.services, service],
        }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setStatus("sending");
        setErrorMessage("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to send message");
            }

            setStatus("success");
            setForm(initialForm);
        } catch (err) {
            setStatus("error");
            setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
        }
    }

    return (
        <section className="py-16 sm:py-24 md:py-32 bg-surface overflow-hidden relative" id="request" aria-label="Contact">
            {/* Subtle background accent */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/[0.03] to-transparent z-0" />
            <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    {/* Left column - Info */}
                    <div className="lg:col-span-5 lg:py-4">
                        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4 block">
                            Get Started
                        </span>
                        <h2 className="font-headline text-3xl md:text-[2.75rem] font-bold mb-5 tracking-tight leading-[1.15]">
                            Contact Us
                        </h2>
                        <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-5" />
                        <p className="text-on-surface-variant text-base leading-relaxed mb-10">
                            Fill out the form and we&rsquo;ll get back to you within 24 hours.
                        </p>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 group">
                                <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                                    <span className="material-symbols-outlined text-xl">call</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-on-surface text-sm">Call Us Directly</h4>
                                    <p className="text-on-surface-variant text-sm">
                                        909-925-1000
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 group">
                                <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                                    <span className="material-symbols-outlined text-xl">mail</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-on-surface text-sm">Email Operations</h4>
                                    <p className="text-on-surface-variant text-sm">
                                        operations@renewlighting.com
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 group">
                                <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                                    <span className="material-symbols-outlined text-xl">schedule</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-on-surface text-sm">Response Time</h4>
                                    <p className="text-on-surface-variant text-sm">
                                        Within 24 hours
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column - Form */}
                    <div className="lg:col-span-7">
                        <div className="bg-surface-container-lowest p-5 sm:p-7 md:p-10 rounded-2xl editorial-shadow-lg border border-outline-variant/10">
                            {status === "success" ? (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                        <span
                                            className="material-symbols-outlined text-primary text-3xl"
                                            style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                            check_circle
                                        </span>
                                    </div>
                                    <h3 className="font-headline text-2xl font-bold mb-2">
                                        Request Submitted!
                                    </h3>
                                    <p className="text-on-surface-variant mb-8 text-base">
                                        We&rsquo;ll be in touch within 24 hours.
                                    </p>
                                    <button
                                        onClick={() => setStatus("idle")}
                                        className="primary-gradient text-on-primary px-6 py-3 rounded-full font-headline font-bold text-sm"
                                    >
                                        Submit Another Request
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                                Name *
                                            </label>
                                            <input
                                                required
                                                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none placeholder:text-on-surface-variant/40"
                                                placeholder="John Doe"
                                                type="text"
                                                value={form.name}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, name: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                                Company
                                            </label>
                                            <input
                                                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none placeholder:text-on-surface-variant/40"
                                                placeholder="Company Name Inc."
                                                type="text"
                                                value={form.company}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, company: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                                Email *
                                            </label>
                                            <input
                                                required
                                                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none placeholder:text-on-surface-variant/40"
                                                placeholder="john@company.com"
                                                type="email"
                                                value={form.email}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, email: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                                Phone
                                            </label>
                                            <input
                                                className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none placeholder:text-on-surface-variant/40"
                                                placeholder="909-555-0123"
                                                type="tel"
                                                value={form.phone}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, phone: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                            Property Address
                                        </label>
                                        <input
                                            className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none placeholder:text-on-surface-variant/40"
                                            placeholder="Street Address, City, State, Zip"
                                            type="text"
                                            value={form.address}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, address: e.target.value }))
                                            }
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-3">
                                                Property Type
                                            </label>
                                            <div className="space-y-2.5">
                                                {["Commercial", "Industrial", "Multifamily"].map(
                                                    (type) => (
                                                        <label
                                                            key={type}
                                                            className="flex items-center gap-3 cursor-pointer group"
                                                        >
                                                            <input
                                                                className="text-primary focus:ring-primary/30 h-4 w-4"
                                                                name="prop_type"
                                                                type="radio"
                                                                checked={form.propertyType === type}
                                                                onChange={() =>
                                                                    setForm((f) => ({ ...f, propertyType: type }))
                                                                }
                                                            />
                                                            <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">{type}</span>
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant block mb-3">
                                                Services Needed
                                            </label>
                                            <div className="space-y-2.5">
                                                {[
                                                    "Lighting Upgrades",
                                                    "Compliance/Audit",
                                                    "Water Heater Pgm",
                                                ].map((service) => (
                                                    <label
                                                        key={service}
                                                        className="flex items-center gap-3 cursor-pointer group"
                                                    >
                                                        <input
                                                            className="text-primary focus:ring-primary/30 h-4 w-4 rounded"
                                                            type="checkbox"
                                                            checked={form.services.includes(service)}
                                                            onChange={() => handleServiceToggle(service)}
                                                        />
                                                        <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">{service}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">
                                            Project Details
                                        </label>
                                        <textarea
                                            className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 px-4 py-3 text-sm transition-all outline-none resize-none placeholder:text-on-surface-variant/40"
                                            placeholder="Tell us about your requirements..."
                                            rows={4}
                                            value={form.details}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, details: e.target.value }))
                                            }
                                        />
                                    </div>

                                    {status === "error" && (
                                        <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium flex items-center gap-3">
                                            <span className="material-symbols-outlined text-lg">error</span>
                                            {errorMessage}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={status === "sending"}
                                        className="w-full primary-gradient text-on-primary py-4 rounded-full font-headline font-bold text-base shadow-[0_4px_16px_rgba(30,109,0,0.3)] hover:shadow-[0_8px_32px_rgba(30,109,0,0.35)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
                                    >
                                        {status === "sending" ? (
                                            "Sending..."
                                        ) : (
                                            <>
                                                Submit Consultation Request
                                                <span className="material-symbols-outlined text-lg">send</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
