const services = [
    {
        num: "01",
        icon: "lightbulb",
        title: "Lighting & Electrical Upgrades",
        description:
            "Upgrade your property with energy-efficient systems designed to improve performance, safety, and long-term savings.",
        details: {
            type: "list" as const,
            items: [
                "LED Retrofits & Energy-Saving Solutions",
                "Exterior & Landscape Lighting Cleanup & Redesign",
                "Security Lighting Solutions",
            ],
        },
        cta: "Get Started",
        ctaIcon: "arrow_forward",
    },
    {
        num: "02",
        icon: "verified_user",
        title: "Safety & Compliance",
        description:
            "Stay ahead of code requirements while improving visibility and security across your property.",
        details: {
            type: "list" as const,
            items: [
                "Lighting Compliance Corrections",
                "Safety-Focused Upgrades",
                "Property-Wide Lighting Assessments",
            ],
        },
        cta: "Get Started",
        ctaIcon: "arrow_forward",
    },
    {
        num: "03",
        icon: "analytics",
        title: "Site Assessments & Audits",
        description:
            "Identify inefficiencies and uncover opportunities for upgrades and incentives.",
        details: {
            type: "tags" as const,
            items: ["Lighting Audits", "Energy Assessments", "System Evaluations"],
        },
        cta: "Get Started",
        ctaIcon: "arrow_forward",
    },
    {
        num: "04",
        icon: "local_fire_department",
        title: "Water Heater & Boiler Replacement",
        description:
            "High-efficiency upgrades designed for multifamily and commercial properties. Incentive programs may cover 60–85% of project costs.",
        details: {
            type: "list" as const,
            items: [
                "Central & In-Unit System Replacements",
                "Streamlined Installation Process",
                "Incentive Programs Available",
            ],
        },
        cta: "Check Availability",
        ctaIcon: "north_east",
    },
];

function ServiceDetails({ details }: { details: (typeof services)[number]["details"] }) {
    switch (details.type) {
        case "list":
            return (
                <ul className="space-y-3 mb-6">
                    {details.items.map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm font-medium text-on-surface-variant">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            );
        case "tags":
            return (
                <div className="flex gap-2 flex-wrap mb-6">
                    {details.items.map((item) => (
                        <span
                            key={item}
                            className="px-3.5 py-1.5 bg-surface-container-low/60 rounded-full text-xs font-semibold text-on-surface-variant border border-outline-variant/15"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            );
    }
}

export default function Services() {
    return (
        <section className="py-16 sm:py-24 md:py-32 bg-surface-container-low" id="services">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                {/* Section header */}
                <div className="mb-16 md:mb-20 max-w-2xl">
                    <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4 block">
                        Services
                    </span>
                    <h2 className="font-headline text-3xl md:text-5xl font-extrabold mb-5 tracking-tight">
                        What We Do
                    </h2>
                    <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-5" />
                    <p className="text-on-surface-variant text-lg leading-relaxed">
                        Full-service lighting, electrical, safety, and facilities solutions
                        for commercial, industrial, and multifamily properties throughout California.
                    </p>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {services.map((service) => (
                        <div
                            key={service.num}
                            className="group bg-surface-container-lowest rounded-2xl p-6 sm:p-8 md:p-10 flex flex-col justify-between border border-outline-variant/15 editorial-shadow hover-lift"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/[0.08] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-400">
                                        <span
                                            className="material-symbols-outlined text-2xl"
                                            style={{ fontVariationSettings: "'FILL' 1" }}
                                        >
                                            {service.icon}
                                        </span>
                                    </div>
                                    <span className="text-5xl font-headline font-black text-primary/[0.06] group-hover:text-primary/[0.12] transition-colors select-none">
                                        {service.num}
                                    </span>
                                </div>
                                <h3 className="font-headline text-xl md:text-2xl font-bold mb-4 tracking-tight group-hover:text-primary transition-colors duration-300">
                                    {service.title}
                                </h3>
                                <p className="text-on-surface-variant text-[15px] leading-relaxed mb-6">
                                    {service.description}
                                </p>
                                <ServiceDetails details={service.details} />
                            </div>
                            <a
                                className="inline-flex items-center gap-2 text-primary font-semibold group/btn text-sm mt-2"
                                href="#request"
                            >
                                {service.cta}
                                <span className="material-symbols-outlined text-lg transition-transform duration-200 group-hover/btn:translate-x-1">
                                    {service.ctaIcon}
                                </span>
                            </a>
                        </div>
                    ))}
                </div>

                {/* Statewide Incentive Programs */}
                <div className="mt-10 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest editorial-shadow overflow-hidden">
                    <div className="px-8 py-7 border-b border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="text-primary font-bold tracking-widest uppercase text-[10px] block mb-1">
                                Check Availability
                            </span>
                            <h3 className="font-headline text-xl md:text-2xl font-bold tracking-tight">
                                Other Lighting &amp; Energy Saving Incentives
                            </h3>
                        </div>
                        <a
                            href="#request"
                            className="shrink-0 inline-flex items-center gap-2 primary-gradient text-on-primary px-6 py-2.5 rounded-full font-headline font-bold text-sm shadow-[0_4px_16px_rgba(30,109,0,0.2)] hover:shadow-[0_8px_24px_rgba(30,109,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        >
                            Check Availability
                            <span className="material-symbols-outlined text-lg">north_east</span>
                        </a>
                    </div>
                    <div className="px-8 py-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                            { icon: "lightbulb", label: "LED Upgrades" },
                            { icon: "tune", label: "Lighting Controls" },
                            { icon: "thermostat", label: "Smart Thermostats" },
                            { icon: "hot_tub", label: "Pool/Spa Heater & Timer" },
                            { icon: "more_horiz", label: "...and more" },
                        ].map((item) => (
                            <div key={item.label} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-surface-container-low/50 hover-lift">
                                <span
                                    className="material-symbols-outlined text-primary text-2xl"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    {item.icon}
                                </span>
                                <span className="text-xs font-semibold text-on-surface-variant">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
