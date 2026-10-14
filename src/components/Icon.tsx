import type { ReactNode } from "react";

const paths = {
    apartment: (
        <>
            <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            <path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M11 21v-3h2v3" />
        </>
    ),
    analytics: (
        <>
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-5 5" />
            <path d="M15 9h4v4" />
        </>
    ),
    arrow_forward: <path d="M5 12h14m-7-7 7 7-7 7" />,
    bolt: <path d="m13 2-3 8H5l6 12 3-9h5L13 2Z" />,
    call: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.45 3.2a2 2 0 0 1-.57 1.7L7.1 10.5a16 16 0 0 0 6 6l1.88-1.89a2 2 0 0 1 1.7-.57l3.2.45a2 2 0 0 1 1.72 2.43Z" />
    ),
    check_circle: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="m8 12 2.5 2.5L16 9" />
        </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
    domain: (
        <>
            <path d="M3 21h18M5 21V7l7-4 7 4v14" />
            <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01M11 21v-4h2v4" />
        </>
    ),
    error: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
        </>
    ),
    hot_tub: (
        <>
            <path d="M4 13h16l-1.5 7h-13L4 13Z" />
            <path d="M6 13V9a2 2 0 0 1 4 0m4 4V7a2 2 0 0 1 4 0M6 20v2m12-2v2" />
        </>
    ),
    inventory_2: (
        <>
            <path d="M4 7h16v14H4zM3 3h18v4H3z" />
            <path d="M10 11h4" />
        </>
    ),
    lightbulb: (
        <>
            <path d="M9 18h6m-5 4h4m-6-7.5a7 7 0 1 1 4 0c-.6.4-1 1-1 1.5h-2c0-.5-.4-1.1-1-1.5Z" />
        </>
    ),
    local_fire_department: (
        <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-3-11-2 2-3 4-3 7-2-1-3-3-3-5-3 3-5 6-5 9a7 7 0 0 0 7 7Zm0-2a3 3 0 0 1-3-3c0-1.5 1-2.7 2-4 .5 1.5 1.5 2 2 2.5 1-1 1.5-2 1.5-3.5 1 1.2 1.5 2.5 1.5 4a4 4 0 0 1-4 4Z" />
    ),
    location_city: (
        <>
            <path d="M3 21h18M5 21V5h9v16m0-10h5v10" />
            <path d="M8 8h3m-3 4h3m-3 4h3m5 0h1m-1 3h1" />
        </>
    ),
    login: (
        <>
            <path d="M10 17l5-5-5-5m5 5H3" />
            <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
        </>
    ),
    logout: (
        <>
            <path d="m14 7 5 5-5 5m5-5H8" />
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
        </>
    ),
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    more_horiz: (
        <>
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
        </>
    ),
    north_east: <path d="M7 17 17 7M8 7h9v9" />,
    request_quote: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8m-8 4h5" />
        </>
    ),
    schedule: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </>
    ),
    send: (
        <>
            <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            <path d="M22 2 11 13" />
        </>
    ),
    space_dashboard: (
        <>
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="5" rx="1" />
            <rect x="13" y="10" width="8" height="11" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
        </>
    ),
    thermostat: (
        <>
            <path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z" />
            <path d="M11 11v6" />
        </>
    ),
    tune: (
        <>
            <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3" />
            <path d="M2 14h4m4-6h4m4 6h4" />
        </>
    ),
    verified: (
        <>
            <path d="m12 3 2.2 1.4 2.6-.1 1.2 2.3 2.3 1.2-.1 2.6L21.5 12l-1.3 2.2.1 2.6-2.3 1.2-1.2 2.3-2.6-.1L12 21.5l-2.2-1.3-2.6.1L6 18l-2.3-1.2.1-2.6L2.5 12l1.3-2.2-.1-2.6L6 6l1.2-2.3 2.6.1L12 3Z" />
            <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </>
    ),
    verified_user: (
        <>
            <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
            <path d="m9 12 2 2 4-4" />
        </>
    ),
    wb_sunny: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
    ),
    workspace_premium: (
        <>
            <circle cx="12" cy="8" r="6" />
            <path d="m8.2 13-1.4 9 5.2-3 5.2 3-1.4-9M9.5 8l1.7 1.7L14.5 6" />
        </>
    ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export default function Icon({
    name,
    className,
}: {
    name: IconName;
    className?: string;
}) {
    return (
        <svg
            aria-hidden="true"
            className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em] ${className ?? ""}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            {paths[name]}
        </svg>
    );
}
