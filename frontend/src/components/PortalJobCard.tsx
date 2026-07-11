import { useState } from "react";

const DESCRIPTION_MAX = 260;

export type PortalJobApplyLink = {
    title: string;
    link: string;
};

export type PortalJobCardProps = {
    title?: string | null;
    company?: string | null;
    location?: string | null;
    salary?: string | null;
    description?: string | null;
    jobType?: string | null;
    postedAt?: string | null;
    logoUrl?: string | null;
    via?: string | null;
    tags?: string[];
    meta?: string[];
    href?: string | null;
    applyLinks?: PortalJobApplyLink[];
};

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateDescription(raw: string | null | undefined): string | null {
    if (!raw?.trim()) return null;
    const clean = stripHtml(raw);
    if (!clean) return null;
    if (clean.length <= DESCRIPTION_MAX) return clean;
    return `${clean.slice(0, DESCRIPTION_MAX)}…`;
}

function CompanyLogo({
    logoUrl,
    companyName,
}: {
    logoUrl?: string | null;
    companyName: string;
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const letter = (companyName.trim()[0] ?? "?").toUpperCase();

    if (!logoUrl || imgFailed) {
        return (
            <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-200 text-sm font-semibold text-neutral-700"
                aria-hidden
            >
                {letter}
            </div>
        );
    }

    return (
        <img
            src={logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md border border-neutral-200 object-contain"
            onError={() => setImgFailed(true)}
        />
    );
}

export default function PortalJobCard({
    title,
    company,
    location,
    salary,
    description,
    jobType,
    postedAt,
    logoUrl,
    via,
    tags = [],
    meta = [],
    href,
    applyLinks = [],
}: PortalJobCardProps) {
    const displayTitle = title?.trim() || "Untitled role";
    const displayCompany = company?.trim() || "Company not listed";
    const displayLocation = location?.trim() || null;
    const displaySalary = salary?.trim() || "Salary not listed";
    const snippet = truncateDescription(description);
    const hasApplyLinks = applyLinks.length > 0;
    const cardHref = href?.trim() && href !== "#" ? href.trim() : null;

    const cardClassName =
        "block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 text-left transition-all duration-200 hover:border-emerald-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 cursor-default";

    const metaItems = [
        jobType?.trim() ? `Type: ${jobType.trim().replace(/_/g, " ")}` : null,
        postedAt?.trim() ? `Posted: ${postedAt.trim()}` : null,
        ...meta.map((m) => m.trim()).filter(Boolean),
    ].filter((item): item is string => Boolean(item));

    const visibleTags = tags
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);

    const inner = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <CompanyLogo logoUrl={logoUrl} companyName={displayCompany} />
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-neutral-900">
                            {displayTitle}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-600">
                            {displayCompany}
                            {displayLocation ? ` · ${displayLocation}` : ""}
                        </p>
                        {via?.trim() ? (
                            <p className="mt-1 text-xs text-neutral-500">
                                via {via.trim()}
                            </p>
                        ) : null}
                    </div>
                    <p className="shrink-0 text-right text-sm text-green-700">
                        {displaySalary}
                    </p>
                </div>

                {snippet ? (
                    <p className="mt-2 text-sm text-neutral-600">{snippet}</p>
                ) : null}

                {metaItems.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
                        {metaItems.map((item) => (
                            <span key={item}>{item}</span>
                        ))}
                    </div>
                ) : null}

                {visibleTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {visibleTags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
                            >
                                {tag.replace(/-/g, " ")}
                            </span>
                        ))}
                    </div>
                ) : null}

                {hasApplyLinks ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {applyLinks.map((opt, i) => (
                            <a
                                key={`${opt.link}-${i}`}
                                href={opt.link}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {opt.title}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );

    // Avoid nested anchors when apply link pills are present
    if (cardHref && !hasApplyLinks) {
        return (
            <a
                href={cardHref}
                target="_blank"
                rel="noreferrer"
                className={cardClassName}
            >
                {inner}
            </a>
        );
    }

    return <div className={cardClassName}>{inner}</div>;
}
