export default function Footer() {
    return (
        <footer className="bg-on-surface text-surface w-full">
            {/* CTA banner */}
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="py-16 flex flex-col md:flex-row items-center justify-between gap-8 border-b border-white/10">
                    <div>
                        <h3 className="font-headline text-2xl md:text-3xl font-bold mb-2">
                            Ready to get started?
                        </h3>
                        <p className="text-surface/60 text-base">
                            Free consultation and project assessment.
                        </p>
                    </div>
                    <a
                        href="#request"
                        className="shrink-0 bg-primary text-on-primary px-8 py-3.5 rounded-full font-headline font-bold text-sm hover:bg-primary-container transition-colors flex items-center gap-2"
                    >
                        Get Started
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </a>
                </div>
            </div>

            {/* Main footer content */}
            <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
                    <div className="col-span-2 md:col-span-1">
                        <div className="text-lg font-bold font-headline mb-4">
                            Renew
                        </div>
                        <p className="text-surface/50 text-sm leading-relaxed mb-6 max-w-xs">
                            Commercial lighting & electrical services since 1994.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-surface/80 mb-5 uppercase tracking-widest text-[10px]">
                            Navigation
                        </h4>
                        <ul className="space-y-3">
                            {[
                                { label: "Home", href: "#" },
                                { label: "Services", href: "#services" },
                                { label: "About", href: "#about" },
                                { label: "Contact", href: "#contact" },
                            ].map((link) => (
                                <li key={link.label}>
                                    <a
                                        className="text-surface/50 hover:text-primary text-sm transition-colors"
                                        href={link.href}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-surface/80 mb-5 uppercase tracking-widest text-[10px]">
                            Contact
                        </h4>
                        <div className="space-y-3 text-sm text-surface/50">
                            <p>
                                673 E Cooley Dr., Suite 108
                                <br />
                                Colton, CA 92324
                            </p>
                            <p>
                                <a href="tel:9099251000" className="hover:text-primary transition-colors">909-925-1000</a>
                            </p>
                            <p>
                                <a href="mailto:operations@renewlighting.com" className="hover:text-primary transition-colors break-all sm:break-normal">operations@renewlighting.com</a>
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-surface/80 mb-5 uppercase tracking-widest text-[10px]">
                            Legal
                        </h4>
                        <ul className="space-y-3">
                            {["Privacy Policy", "Terms of Service", "Compliance Info"].map(
                                (label) => (
                                    <li key={label}>
                                        <a
                                            className="text-surface/50 hover:text-primary text-sm transition-colors"
                                            href="#"
                                        >
                                            {label}
                                        </a>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-white/[0.06]">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-surface/40">
                    <div>&copy; {new Date().getFullYear()} Renew Lighting Services. All rights reserved.</div>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Fully Licensed &amp; Insured Contractor
                    </div>
                </div>
            </div>
        </footer>
    );
}
