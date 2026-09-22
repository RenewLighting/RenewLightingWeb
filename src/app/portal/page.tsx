import Link from "next/link";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RequestForm from "@/components/RequestForm";

const steps = [
  { number: "01", title: "Tell us what you need", text: "Share your property, service needs, and project details in one request." },
  { number: "02", title: "We review the project", text: "Our operations team reviews the scope and follows up within one business day." },
  { number: "03", title: "Plan the next step", text: "We align on timing, site details, and the right proposal for your property." },
];

export default function CustomerPortalPage() {
  return (
    <>
      <Navbar />
      <main className="bg-surface pt-24">
        <section className="relative overflow-hidden border-b border-outline-variant/15 bg-surface-container-low">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/[0.08] to-transparent" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-16 sm:py-24">
            <div className="max-w-3xl">
              <span className="text-primary font-bold tracking-widest uppercase text-xs">Customer workspace</span>
              <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mt-4 mb-6">
                Move your property forward.
              </h1>
              <p className="text-lg sm:text-xl text-on-surface-variant leading-relaxed max-w-2xl">
                Request a consultation, describe the work, and connect with the Renew team about lighting, electrical, compliance, and energy projects.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <a href="#request" className="primary-gradient text-on-primary px-6 py-3.5 rounded-full font-headline font-bold text-sm text-center">Start a project request</a>
                <a href="tel:9099251000" className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 px-6 py-3.5 rounded-full font-headline font-bold text-sm text-center">Call 909-925-1000</a>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-14 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((step) => (
              <div key={step.number} className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 sm:p-8 editorial-shadow">
                <span className="text-primary font-headline text-3xl font-black">{step.number}</span>
                <h2 className="font-headline text-xl font-bold mt-6 mb-3">{step.title}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <RequestForm />

        <section className="border-t border-outline-variant/15 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <span className="text-primary font-bold tracking-widest uppercase text-xs">Need a direct answer?</span>
              <h2 className="font-headline text-3xl font-extrabold mt-3 mb-3">Talk with Renew Operations.</h2>
              <p className="text-on-surface-variant max-w-2xl">Call us for urgent service questions or email the team with documents, site details, or an existing proposal.</p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
              <a href="tel:9099251000" className="primary-gradient text-on-primary px-6 py-3 rounded-full font-headline font-bold text-sm text-center">Call operations</a>
              <a href="mailto:operations@renewlighting.com" className="bg-surface-container-lowest border border-outline-variant/30 text-on-surface px-6 py-3 rounded-full font-headline font-bold text-sm text-center">Email operations</a>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 text-sm text-on-surface-variant">
          <Link href="/" className="hover:text-primary">Return to Renew Lighting Services</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
