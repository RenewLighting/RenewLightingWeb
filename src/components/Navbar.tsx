"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
    { href: "#", label: "Home" },
    { href: "#services", label: "Services" },
    { href: "#about", label: "About" },
    { href: "#request", label: "Contact" },
];

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled
                ? "glass-nav shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] py-0"
                : "bg-surface/80 backdrop-blur-sm py-1"
                }`}
        >
            <div className="flex justify-between items-center px-6 lg:px-10 py-3 max-w-7xl mx-auto">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <Image
                        alt="Renew Lighting Services Logo"
                        className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
                        src="/logo-fixed-closer-transparent.svg"
                        width={36}
                        height={36}
                    />
                    <span className={`text-lg font-extrabold tracking-tight font-headline hidden sm:block transition-colors duration-500 ${scrolled ? "text-on-surface" : "text-on-surface"}`}>
                        Renew
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-1 font-headline text-[13px] font-semibold">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            className={`relative px-4 py-2 rounded-lg hover:text-primary transition-all duration-200 ${scrolled ? "text-on-surface-variant hover:bg-primary/[0.05]" : "text-on-surface-variant hover:bg-primary/[0.05]"}`}
                            href={link.href}
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <a
                        className="hidden sm:inline-flex items-center gap-2 primary-gradient text-on-primary pl-5 pr-4 py-2.5 rounded-full font-headline font-bold text-sm shadow-[0_2px_8px_rgba(30,109,0,0.3)] hover:shadow-[0_4px_16px_rgba(30,109,0,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        href="#request"
                    >
                        Get a Quote
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </a>

                    <button
                        className={`md:hidden w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${scrolled ? "hover:bg-surface-container" : "hover:bg-surface-container"}`}
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={`material-symbols-outlined text-xl transition-colors duration-500 ${scrolled ? "text-on-surface" : "text-on-surface"}`}>
                            {mobileOpen ? "close" : "menu"}
                        </span>
                    </button>
                </div>
            </div>

            {/* Mobile menu with slide-down */}
            <div
                className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="glass-nav border-t border-outline-variant/10 px-6 py-5 space-y-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            className="block px-4 py-3 font-headline font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/[0.05] rounded-lg transition-all"
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        className="block mt-3 text-center primary-gradient text-on-primary py-3 rounded-full font-headline font-bold text-sm"
                        href="#request"
                        onClick={() => setMobileOpen(false)}
                    >
                        Get a Quote
                    </a>
                </div>
            </div>
        </nav>
    );
}
