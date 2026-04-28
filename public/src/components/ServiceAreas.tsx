const areas = [
    {
        name: "Greater Los Angeles",
        description: "Inland Empire, San Gabriel Valley, South Bay, Westside.",
        icon: "location_city",
    },
    {
        name: "Orange County",
        description: "Irvine, Newport Beach, Anaheim, Santa Ana, South County.",
        icon: "apartment",
    },
    {
        name: "San Francisco Bay Area",
        description: "San Jose, Oakland, Peninsula, North Bay.",
        icon: "domain",
    },
    {
        name: "San Diego & Desert",
        description: "North County, Palm Springs, Cathedral City, Indio.",
        icon: "wb_sunny",
    },
];

export default function ServiceAreas() {
    return (
        <section className="py-16 sm:py-24 md:py-32 bg-surface-container-low" id="areas">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 sm:mb-14 gap-6 sm:gap-8">
                    <div className="max-w-xl">
                        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-4 block">
                            Coverage
                        </span>
                        <h2 className="font-headline text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                            Where We Work
                        </h2>
                        <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-4" />
                        <p className="text-on-surface-variant text-base leading-relaxed">
                            Regional hubs across Southern and Northern California
                            for fast, reliable service statewide.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 text-primary font-semibold text-sm bg-primary/[0.06] px-4 py-2 rounded-full">
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Licensed State Contractor
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {areas.map((area) => (
                        <div
                            key={area.name}
                            className="group bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 hover-lift"
                        >
                            <div className="w-10 h-10 rounded-xl bg-primary/[0.07] flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-on-primary transition-all duration-300">
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {area.icon}
                                </span>
                            </div>
                            <h4 className="font-headline font-bold text-on-surface mb-2 text-[15px]">
                                {area.name}
                            </h4>
                            <p className="text-sm text-on-surface-variant leading-relaxed">
                                {area.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
