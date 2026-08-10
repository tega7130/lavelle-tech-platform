import * as React from "react";

type IconProps = React.SVGAttributes<SVGSVGElement>;

function Svg({ children, ...props }: React.PropsWithChildren<IconProps>) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="6" height="6" rx="1" />
    <rect x="10" y="2" width="6" height="6" rx="1" />
    <rect x="2" y="10" width="6" height="6" rx="1" />
    <rect x="10" y="10" width="6" height="6" rx="1" />
  </Svg>
);

export const ProgrammeIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="2.5" width="12" height="13" rx="1.5" />
    <line x1="6" y1="6" x2="12" y2="6" />
    <line x1="6" y1="9" x2="12" y2="9" />
    <line x1="6" y1="12" x2="10" y2="12" />
  </Svg>
);

export const CatalogueIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="6.5" />
    <path d="M11.5 6.5 9.8 9.8 6.5 11.5 8.2 8.2Z" />
  </Svg>
);

export const DeadlinesIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" />
    <line x1="2.5" y1="7" x2="15.5" y2="7" />
    <line x1="6" y1="2" x2="6" y2="5" />
    <line x1="12" y1="2" x2="12" y2="5" />
  </Svg>
);

export const AssessmentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 15V8" />
    <path d="M7.5 15V4" />
    <path d="M12 15v-5" />
    <line x1="1.5" y1="15.5" x2="16.5" y2="15.5" />
  </Svg>
);

export const ExamsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 2.5h10v13H4z" />
    <line x1="6.5" y1="6" x2="11.5" y2="6" />
    <line x1="6.5" y1="9" x2="11.5" y2="9" />
    <line x1="6.5" y1="12" x2="9.5" y2="12" />
  </Svg>
);

export const CredentialsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="7" r="4.2" />
    <path d="M6.4 10.6 5.2 15.5l3.8-2 3.8 2-1.2-4.9" />
  </Svg>
);

export const AiIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5h12v8H8l-3.5 3v-3H3Z" />
    <circle cx="7" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const ProfileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6.5" r="3" />
    <path d="M3 15c0-3.3 2.7-5 6-5s6 1.7 6 5" />
  </Svg>
);

export const SupportIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="6.5" />
    <path d="M7 7a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4" />
    <circle cx="9" cy="12.6" r="0.7" fill="currentColor" stroke="none" />
  </Svg>
);

export const SignOutIcon = (p: IconProps) => (
  <Svg strokeWidth={1.5} width={15} height={15} {...p}>
    <path d="M7 15.5H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 2.5h3" />
    <path d="M11.5 12 15 9l-3.5-3" />
    <path d="M15 9H6.5" />
  </Svg>
);

export const BellIcon = (p: IconProps) => (
  <Svg width={17} height={17} {...p}>
    <path d="M4.5 7.5a4.5 4.5 0 0 1 9 0c0 3 1 4.5 1 4.5H3.5s1-1.5 1-4.5Z" />
    <path d="M7.3 14.5a1.8 1.8 0 0 0 3.4 0" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg viewBox="0 0 16 16" width={13} height={13} strokeWidth={1.6} {...p}>
    <path d="M9.5 4.5 6 8l3.5 3.5" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg viewBox="0 0 16 16" width={13} height={13} strokeWidth={1.6} {...p}>
    <path d="M6.5 4.5 10 8l-3.5 3.5" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg strokeWidth={1.6} {...p}>
    <path d="M11 4.5 6 9l5 4.5" />
  </Svg>
);

/** Admin rail icons — each is a single compound path, per the source design's NAV_ICONS table. */
export const ADMIN_NAV_PATHS: Record<string, string> = {
  overview: "M2.5 2.5h5v5h-5zM10.5 2.5h5v5h-5zM2.5 10.5h5v5h-5zM10.5 10.5h5v5h-5z",
  programmes: "M9 2.4 16 6l-7 3.6L2 6zM2 9.9l7 3.6 7-3.6",
  content: "M3 3.5h12v11H3zM6 7h6M6 10h4",
  marking: "M3 3.5h12v11H3zM6 9l2.2 2.2L12.6 7",
  exambuilder: "M4 2.5h10v13H4zM6.6 6h4.8M6.6 9h4.8M6.6 12h2.8",
  website:
    "M9 1.8a7.2 7.2 0 1 0 0 14.4A7.2 7.2 0 0 0 9 1.8M1.8 9h14.4M9 1.8c1.9 2 2.9 4.5 2.9 7.2s-1 5.2-2.9 7.2c-1.9-2-2.9-4.5-2.9-7.2S7.1 3.8 9 1.8",
  staff:
    "M6.4 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M2 15.2c.5-2.4 2.2-3.7 4.4-3.7s3.9 1.3 4.4 3.7M12.4 6.6l1.3 1.3 2.6-2.7",
  cohorts:
    "M6.4 7.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8M2.2 14.6c.5-2.2 2.1-3.4 4.2-3.4s3.7 1.2 4.2 3.4M12 3.9a2 2 0 0 1 0 3.8M12.6 11.1c1.4.3 2.3 1.5 2.7 3.2",
  candidates:
    "M7 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M2.6 15.2c.6-2.4 2.3-3.7 4.4-3.7s3.8 1.3 4.4 3.7M12.6 4.4a2.2 2.2 0 0 1 0 4.1M13.2 11.6c1.5.4 2.5 1.6 2.9 3.4",
  support: "M3 4h12v8H8l-3.5 3v-3H3z",
  finance: "M2.5 4.5h13v9h-13zM6.8 9h4.4M6.8 11h4.4M9 6.4v6.2",
  comms: "M3 7.3v3.4l8 3.4V3.9zM12.8 7.6v2.8M15 6.9v4.2",
  certs:
    "M9 2.6 11 4l2.3-.2.6 2.2 1.6 1.7-1.2 1.9.2 2.3-2.2.6L10.7 15 9 13.9 6.6 15 5 12.5l-2.2-.6.2-2.3L1.8 7.7l1.6-1.7L4 3.8 6.3 4z",
  invigilation: "M1.8 9S4.4 4.4 9 4.4 16.2 9 16.2 9 13.6 13.6 9 13.6 1.8 9 1.8 9ZM9 11.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
  reviews:
    "M9 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L9 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
};

export function AdminNavIcon({ name, ...p }: { name: string } & IconProps) {
  return (
    <Svg width={16} height={16} className="flex-none" {...p}>
      <path d={ADMIN_NAV_PATHS[name] ?? ADMIN_NAV_PATHS.overview} />
    </Svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.5 7 13l7.5-8" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="8" width="10" height="7.5" rx="1.3" />
    <path d="M6 8V5.5a3 3 0 0 1 6 0V8" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 9s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5Z" />
    <circle cx="9" cy="9" r="2" />
  </Svg>
);
