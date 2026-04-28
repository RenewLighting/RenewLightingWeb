import Image from "next/image";

export default function About() {
    return (
        <section className="py-16 sm:py-24 md:py-32 bg-surface overflow-hidden" id="about">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-24 items-center">
                    {/* Image column */}
                    <div className="relative">
                        <div className="aspect-[4/5] rounded-2xl overflow-hidden editorial-shadow-lg relative">
                            <Image
                                className="object-cover"
                                alt="Professional electrician working on a modern commercial electrical panel"
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJfLT-z5hbEOqDxXCCvEo2hia8y16skGEdjyp4ta5UIKP-BgouQvmlvpNtj8zAbQgqgA0pY5_wo4gs5LDDmQt_H_-VZl1KelIBD_JYlBdgAPslXmzn6oss_ajM5jYWwdU-8g6zCeWzi3abZ2dpLaycfq8f8K2uh7ncDYrR_oFYhs4n4INFCRRtB1eK_hZiq5gfiQpZoOe9Kfu8G_S38_u0iLDUuYEU0ywyfn9HrdZa-QvJKgqQuDEydOAz48B63zvczXM6ydg3xxNF"
                                fill
                                sizes="(max-width: 1024px) 100vw, 50vw"
                            />
                        </div>
                        {/* Floating stat badge */}
                        <div className="absolute -bottom-6 right-2 md:-bottom-8 md:-right-8 bg-on-surface text-surface px-6 py-5 md:px-8 md:py-6 rounded-2xl hidden sm:block editorial-shadow-lg">
                            <div className="text-4xl font-black font-headline leading-none">30+</div>
                            <div className="text-xs font-semibold uppercase tracking-widest mt-1 opacity-70">
                                Years of Excellence
                            </div>
                        </div>
                        {/* Subtle decorative ring */}
                        <div className="absolute -top-4 -left-4 w-24 h-24 border-2 border-primary/15 rounded-2xl hidden lg:block" />
                    </div>

                    {/* Content column */}
                    <div>
                        <span className="text-primary font-bold tracking-widest uppercase text-xs mb-5 block">
                            About Our Company
                        </span>
                        <h2 className="font-headline text-3xl md:text-[2.75rem] font-bold text-on-surface tracking-tight leading-[1.15] mb-6">
                            Safe, clean, and functional environments.
                        </h2>
                        <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-6" />
                        <h3 className="text-primary font-headline text-lg font-extrabold italic mb-8">
                            &ldquo;Where your Standards meet our service&rdquo;
                        </h3>
                        <div className="space-y-5 text-base md:text-lg text-on-surface-variant leading-relaxed">
                            <p>
                                Renew Lighting Services delivers safe, clean, and functional environments
                                for commercial, industrial, and multifamily properties — backed by over
                                30 years of hands-on industry experience.
                            </p>
                            <p>
                                Full compliance with California&rsquo;s energy and safety standards,
                                so you can focus on running your property.
                            </p>
                        </div>

                        {/* Stats row */}
                        <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-6">
                            <div className="text-center sm:text-left">
                                <div className="text-primary font-black text-2xl sm:text-3xl font-headline mb-1">98%</div>
                                <div className="text-[10px] sm:text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                    Client Retention
                                </div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-primary font-black text-2xl sm:text-3xl font-headline mb-1">24/7</div>
                                <div className="text-[10px] sm:text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                    Emergency Support
                                </div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-primary font-black text-2xl sm:text-3xl font-headline mb-1">500+</div>
                                <div className="text-[10px] sm:text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                                    Projects Completed
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
