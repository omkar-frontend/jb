import { useState } from "react";

/**
 * A company logo, or the company's initial when there is nothing to show.
 *
 * Providers hand us logo URLs that are frequently dead — hotlinked assets that
 * 404, hosts that block cross-origin requests, CDNs that have expired the file.
 * A bare <img> renders those as a broken-image icon, so the fallback has to
 * cover a load *failure*, not just a missing URL.
 */
export default function CompanyLogo({
    logoUrl,
    companyName,
    className = "h-12 w-12",
}: {
    logoUrl?: string | null;
    companyName: string;
    /** Size classes; everything else about the box is fixed here. */
    className?: string;
}) {
    // The URL that failed, rather than a boolean: a card reused for a different
    // job would otherwise stay stuck on initials even though its new logo is
    // perfectly good.
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    const src = logoUrl?.trim() || null;
    const box = `${className} shrink-0 rounded-md border border-neutral-200`;

    if (!src || failedUrl === src) {
        return (
            <div
                className={`${box} flex items-center justify-center bg-neutral-200 text-sm font-semibold text-neutral-700`}
                aria-hidden
            >
                {(companyName.trim()[0] ?? "?").toUpperCase()}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt=""
            className={`${box} object-contain`}
            onError={() => setFailedUrl(src)}
        />
    );
}
