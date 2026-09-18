import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";

import { EmployeeSignIn, EmployeeSignOut } from "@/components/EmployeeAuthActions";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type EmployeePageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

const applications = [
  {
    name: "Inventory",
    description: "Manage warehouse stock, equipment, and barcode workflows.",
    icon: "inventory_2",
    href: "/api/inventory-access",
    available: true,
  },
  {
    name: "Quoting",
    description: "Build estimates and prepare customer proposals.",
    icon: "request_quote",
    available: false,
  },
  {
    name: "Project Dashboard",
    description: "Track active projects, schedules, and field progress.",
    icon: "space_dashboard",
    available: false,
  },
] as const;

function getLocalCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl) return "/employee";

  try {
    const url = new URL(callbackUrl, "https://renewlighting.com");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/employee";
  }
}

export default async function EmployeePage({ searchParams }: EmployeePageProps) {
  const session = await getServerSession(authOptions);
  const { callbackUrl, error } = await searchParams;
  const safeCallbackUrl = getLocalCallbackUrl(callbackUrl);
  const authErrorMessage = error === "AccessDenied"
    ? "Access is limited to verified @renewlighting.com accounts."
    : error
      ? "Employee sign-in is temporarily unavailable. Please contact your administrator."
      : null;

  if (!session?.user?.email) {
    return (
      <main className="min-h-[100dvh] bg-surface flex items-center justify-center px-6 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,109,0,0.08),transparent_45%,rgba(26,28,25,0.04))]" />
        <div className="relative w-full max-w-md bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-7 sm:p-10 editorial-shadow-lg">
          <Link href="/" className="inline-flex items-center gap-3 mb-10 group">
            <Image
              src="/logo-fixed-closer-transparent.svg"
              alt="Renew Lighting Services"
              width={42}
              height={42}
              className="h-10 w-auto transition-transform group-hover:scale-105"
            />
            <span className="font-headline font-extrabold text-on-surface">
              Renew Lighting Services
            </span>
          </Link>

          <span className="text-primary font-bold tracking-widest uppercase text-xs block mb-4">
            Employee Access
          </span>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3">
            Sign in to your workspace
          </h1>
          <p className="text-on-surface-variant leading-relaxed mb-8">
            Use your company Google account to access Renew applications.
          </p>

          {authErrorMessage && (
            <div className="bg-error-container text-on-error-container rounded-xl px-4 py-3 text-sm font-medium mb-5">
              {authErrorMessage}
            </div>
          )}

          <EmployeeSignIn callbackUrl={safeCallbackUrl} />
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-base text-primary">verified_user</span>
            Authorized employees only
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-surface">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo-fixed-closer-transparent.svg"
              alt="Renew Lighting Services"
              width={38}
              height={38}
              className="h-9 w-auto"
            />
            <span className="font-headline font-extrabold text-on-surface truncate">
              Employee Portal
            </span>
          </Link>
          <EmployeeSignOut />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-14 sm:py-20">
        <div className="mb-10 sm:mb-14">
          <span className="text-primary font-bold tracking-widest uppercase text-xs block mb-3">
            Renew Workspace
          </span>
          <h1 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface mb-3">
            Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-on-surface-variant">
            Choose an application to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {applications.map((application) => {
            const content = (
              <>
                <div className="w-12 h-12 rounded-xl bg-primary/[0.08] text-primary flex items-center justify-center mb-8">
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {application.icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                      {application.name}
                    </h2>
                    {!application.available && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {application.description}
                  </p>
                </div>
                {application.available && (
                  <span className="material-symbols-outlined text-primary absolute top-7 right-7 transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                )}
              </>
            );

            return application.available ? (
              <Link
                key={application.name}
                href={application.href}
                className="group relative min-h-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-7 editorial-shadow hover-lift flex flex-col justify-between"
              >
                {content}
              </Link>
            ) : (
              <div
                key={application.name}
                aria-disabled="true"
                className="relative min-h-64 bg-surface-container-low border border-outline-variant/15 rounded-2xl p-7 flex flex-col justify-between opacity-70"
              >
                {content}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-on-surface-variant">
          Signed in as {session.user.email}
        </p>
      </section>
    </main>
  );
}