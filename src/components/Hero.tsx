import Image from "next/image";

export default function Hero() {
    return (
        <header className="relative min-h-[100dvh] flex items-center pt-20 overflow-hidden bg-surface">
            {/* Background image – light tinted overlay */}
            <div className="absolute inset-0 z-0">
                <Image
                    className="w-full h-full object-cover opacity-15"
                    alt="High-end architectural ceiling with integrated linear LED lighting"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_SviKYpkFLPcMnT4SQnFK8f1OtkbcfxvOp7OQgT7pr0xSbekHCEmsWHj2yg0pTg55fXk0a08vEPjwEAqxNaMe75SVECS7N8wJvZrx37-fHmuf8OMnJWiJkESR_lK-56J_Mj1TpWRo2FTKaXHlDeQ5X679ETXi_Sce-MF_TweOVYTa1AXIj40rhdnkuM2Eh_ibdfGwmL74M2g3cN1ImtYkIJjpVsj_LYg_pfLEIqE4RUwP9g0HobrvRexa6jupmoVjMrSF-RDvFeyC"
                    fill
                    priority
                />
                {/* Soft light gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface/90 to-surface-container-low/60" />
                {/* Accent glow */}
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-primary/[0.05] rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 w-full">
                <div className="max-w-3xl">
                    {/* Badge */}
                    <div className="animate-fade-up inline-flex items-center gap-2.5 px-4 py-1.5 bg-primary/[0.08] border border-primary/[0.15] text-primary rounded-full text-xs font-bold tracking-widest uppercase mb-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Energy-Efficient Solutions
                    </div>

                    {/* Headline */}
                    <h1 className="animate-fade-up animate-delay-100 font-headline text-[clamp(1.25rem,3.5vw,2.5rem)] font-extrabold text-on-surface tracking-[-0.035em] leading-[1.12] mb-6 sm:mb-7">
                        Energy Efficient Electrical, Lighting, Safety Compliance &amp; Water Heater/Boiler Solutions
                    </h1>

                    {/* Subheadline */}
                    <p className="animate-fade-up animate-delay-200 text-lg md:text-xl text-on-surface-variant leading-relaxed mb-10 max-w-xl">
                        Sustainably focused lighting, electrical, compliance, and energy program solutions for commercial, industrial, and multifamily properties throughout California — backed by over 30 years of hands-on experience.
                    </p>

                    {/* CTAs */}
                    <div className="animate-fade-up animate-delay-300 flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <a
                            className="primary-gradient text-on-primary px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-headline font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(30,109,0,0.2)] hover:shadow-[0_8px_40px_rgba(30,109,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                            href="#request"
                        >
                            Contact Us
                            <span className="material-symbols-outlined text-xl">arrow_forward</span>
                        </a>
                        <a
                            className="bg-on-surface/[0.05] text-on-surface border border-on-surface/[0.12] px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-headline font-bold text-sm sm:text-base flex items-center justify-center hover:bg-on-surface/[0.09] hover:border-on-surface/[0.2] transition-all duration-200"
                            href="#services"
                        >
                            View Our Services
                        </a>
                    </div>
                </div>

                {/* Trust indicators row */}
                <div className="animate-fade-up animate-delay-400 mt-12 sm:mt-20 pt-8 sm:pt-10 border-t border-outline-variant/30">
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-12 gap-y-4 items-center">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            <span className="text-sm font-medium text-on-surface-variant">Licensed &amp; Insured</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                            <span className="text-sm font-medium text-on-surface-variant">24/7 Response</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                            <span className="text-sm font-medium text-on-surface-variant">30+ Years</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                            <span className="text-sm font-medium text-on-surface-variant">Statewide Service</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
