import { useEffect, useState } from "react";
import axios from "axios";
import Select, { type StylesConfig } from "react-select";
import SubHeader from "../../components/SubHeader";

const FILTER_DEBOUNCE_MS = 500;
const JOBS_PER_PAGE_HINT = 10;

const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => window.clearTimeout(timeoutId);
    }, [delayMs, value]);

    return debouncedValue;
};

type Option = {
    value: string;
    label: string;
};

const selectControlStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
        ...base,
        backgroundColor: "#ffffff",
        borderColor: state.isFocused ? "#a3a3a3" : "#e5e5e5",
        boxShadow: "none",
        minHeight: "40px",
        fontSize: "14px",
        borderRadius: "8px",
        ":hover": {
            borderColor: "#d4d4d4",
        },
    }),
    menu: (base: Record<string, unknown>) => ({
        ...base,
        backgroundColor: "#ffffff",
        border: "1px solid #e5e5e5",
        fontSize: "14px",
        borderRadius: "8px",
        boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
    }),
    option: (
        base: Record<string, unknown>,
        state: { isFocused: boolean },
    ) => ({
        ...base,
        backgroundColor: state.isFocused ? "#f5f5f5" : "#ffffff",
        color: "#171717",
        fontSize: "14px",
    }),
    singleValue: (base: Record<string, unknown>) => ({
        ...base,
        color: "#171717",
        fontSize: "14px",
    }),
    input: (base: Record<string, unknown>) => ({
        ...base,
        color: "#171717",
        fontSize: "14px",
    }),
    placeholder: (base: Record<string, unknown>) => ({
        ...base,
        color: "#737373",
        fontSize: "14px",
    }),
    dropdownIndicator: (base: Record<string, unknown>) => ({
        ...base,
        color: "#737373",
    }),
    indicatorSeparator: (base: Record<string, unknown>) => ({
        ...base,
        backgroundColor: "#e5e5e5",
    }),
};

const selectStylesSingle = selectControlStyles as StylesConfig<Option, false>;

const filterPillClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition  ${
        active
            ? "border-emerald-600 bg-emerald-50 text-emerald-900"
            : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
    }`;

const COUNTRY_OPTIONS: Option[] = [
    { value: "us", label: "United States" },
    { value: "gb", label: "United Kingdom" },
    { value: "ca", label: "Canada" },
    { value: "au", label: "Australia" },
    { value: "de", label: "Germany" },
    { value: "fr", label: "France" },
    { value: "in", label: "India" },
    { value: "nl", label: "Netherlands" },
    { value: "br", label: "Brazil" },
    { value: "mx", label: "Mexico" },
    { value: "es", label: "Spain" },
    { value: "it", label: "Italy" },
    { value: "pl", label: "Poland" },
    { value: "ch", label: "Switzerland" },
    { value: "sg", label: "Singapore" },
    { value: "nz", label: "New Zealand" },
    { value: "za", label: "South Africa" },
    { value: "at", label: "Austria" },
    { value: "be", label: "Belgium" },
    { value: "jp", label: "Japan" },
];

const LANGUAGE_OPTIONS: Option[] = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "it", label: "Italian" },
    { value: "nl", label: "Dutch" },
    { value: "pt", label: "Portuguese" },
    { value: "pl", label: "Polish" },
    { value: "ja", label: "Japanese" },
];

const DATE_POSTED_OPTIONS: Option[] = [
    { value: "all", label: "Any time" },
    { value: "today", label: "Today" },
    { value: "3days", label: "Last 3 days" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
];

const EMPLOYMENT_TYPES: Option[] = [
    { value: "FULLTIME", label: "Full-time" },
    { value: "PARTTIME", label: "Part-time" },
    { value: "CONTRACTOR", label: "Contractor" },
    { value: "INTERN", label: "Intern" },
];

const JOB_REQUIREMENTS: Option[] = [
    { value: "no_experience", label: "No experience" },
    {
        value: "under_3_years_experience",
        label: "Under 3 years experience",
    },
    {
        value: "more_than_3_years_experience",
        label: "3+ years experience",
    },
    { value: "no_degree", label: "No degree" },
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

type JSearchJob = {
    job_id?: string;
    job_title?: string;
    employer_name?: string;
    employer_logo?: string;
    employer_website?: string;
    job_publisher?: string;
    job_employment_type?: string;
    job_employment_types?: string[];
    job_apply_link?: string;
    job_google_link?: string;
    job_description?: string;
    job_city?: string;
    job_state?: string;
    job_country?: string;
    job_location?: string;
    job_is_remote?: boolean | null;
};

type JSearchSearchBody = {
    status?: string;
    request_id?: string;
    parameters?: Record<string, unknown>;
    data?: JSearchJob[];
};

type SearchApiResponse = {
    success?: boolean;
    error?: string;
    data?: JSearchSearchBody;
};

function jobCardHref(job: JSearchJob): string {
    const apply = job.job_apply_link?.trim();
    if (apply) return apply;
    const google = job.job_google_link?.trim();
    if (google) return google;
    return "";
}

function JSearchCompanyAvatar({
    logoSrc,
    companyName,
}: {
    logoSrc: string | null;
    companyName: string;
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const letter = (companyName.trim()[0] ?? "?").toUpperCase();

    if (!logoSrc || imgFailed) {
        return (
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-200 text-sm font-semibold text-neutral-700"
                aria-hidden
            >
                {letter}
            </div>
        );
    }

    return (
        <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 shrink-0 rounded object-contain"
            onError={() => setImgFailed(true)}
        />
    );
}

export default function JSearch() {
    const [query, setQuery] = useState("Software developer");
    const [page, setPage] = useState(1);
    const [country, setCountry] = useState<Option | null>(
        COUNTRY_OPTIONS.find((c) => c.value === "us") ?? null,
    );
    const [language, setLanguage] = useState<Option | null>(
        LANGUAGE_OPTIONS.find((l) => l.value === "en") ?? null,
    );
    const [datePosted, setDatePosted] = useState<Option | null>(
        DATE_POSTED_OPTIONS[0] ?? null,
    );
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [employmentSel, setEmploymentSel] = useState<Option[]>([]);
    const [requirementsSel, setRequirementsSel] = useState<Option[]>([]);
    const [radiusKm, setRadiusKm] = useState("");
    const [excludePublishers, setExcludePublishers] = useState("");

    const [payload, setPayload] = useState<JSearchSearchBody | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debouncedQuery = useDebouncedValue(query, FILTER_DEBOUNCE_MS);
    const debouncedRadius = useDebouncedValue(radiusKm, FILTER_DEBOUNCE_MS);
    const debouncedExclude = useDebouncedValue(
        excludePublishers,
        FILTER_DEBOUNCE_MS,
    );

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        setPage(1);
    }, [
        debouncedQuery,
        country,
        language,
        datePosted,
        remoteOnly,
        employmentSel,
        requirementsSel,
        debouncedRadius,
        debouncedExclude,
    ]);

    useEffect(() => {
        const ctrl = new AbortController();

        void (async () => {
            setLoading(true);
            setError(null);
            try {
                const params: Record<string, string | number | boolean> = {
                    page,
                    num_pages: 1,
                };

                const q = debouncedQuery.trim();
                params.query =
                    q ||
                    "software developer jobs"; /* backend also defaults; keep in sync */

                if (country?.value) params.country = country.value;
                if (language?.value) params.language = language.value;
                if (datePosted?.value && datePosted.value !== "all") {
                    params.date_posted = datePosted.value;
                }
                if (remoteOnly) params.work_from_home = true;
                if (employmentSel.length > 0) {
                    params.employment_types = employmentSel
                        .map((e) => e.value)
                        .join(",");
                }
                if (requirementsSel.length > 0) {
                    params.job_requirements = requirementsSel
                        .map((e) => e.value)
                        .join(",");
                }
                const r = debouncedRadius.trim();
                if (r !== "" && !Number.isNaN(Number(r))) {
                    params.radius = Number(r);
                }
                const ex = debouncedExclude.trim();
                if (ex) params.exclude_job_publishers = ex;

                const response = await axios.get<SearchApiResponse>(
                    `${backendUrl}/jsearch/search`,
                    {
                        signal: ctrl.signal,
                        params,
                    },
                );

                if (!response.data.success && response.data.error) {
                    setError(response.data.error);
                    setPayload(null);
                    return;
                }

                setPayload(response.data.data ?? null);
            } catch (err: unknown) {
                if (axios.isCancel(err)) return;
                const message =
                    axios.isAxiosError(err) &&
                    typeof err.response?.data?.error === "string"
                        ? err.response.data.error
                        : "Could not load JSearch results";
                setError(message);
                setPayload(null);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        })();

        return () => ctrl.abort();
    }, [
        backendUrl,
        page,
        debouncedQuery,
        country,
        language,
        datePosted,
        remoteOnly,
        employmentSel,
        requirementsSel,
        debouncedRadius,
        debouncedExclude,
    ]);

    const jobs = payload?.data ?? [];
    const canGoPrev = page > 1 && !loading;
    const canGoNext =
        !loading && jobs.length >= JOBS_PER_PAGE_HINT;

    const resetFilters = () => {
        setQuery("Software developer");
        setPage(1);
        setCountry(COUNTRY_OPTIONS.find((c) => c.value === "us") ?? null);
        setLanguage(LANGUAGE_OPTIONS.find((l) => l.value === "en") ?? null);
        setDatePosted(DATE_POSTED_OPTIONS[0] ?? null);
        setRemoteOnly(false);
        setEmploymentSel([]);
        setRequirementsSel([]);
        setRadiusKm("");
        setExcludePublishers("");
    };

    const toggleEmployment = (opt: Option) => {
        setEmploymentSel((prev) => {
            const exists = prev.some((p) => p.value === opt.value);
            if (exists) return prev.filter((p) => p.value !== opt.value);
            return [...prev, opt];
        });
    };

    const toggleRequirement = (opt: Option) => {
        setRequirementsSel((prev) => {
            const exists = prev.some((p) => p.value === opt.value);
            if (exists) return prev.filter((p) => p.value !== opt.value);
            return [...prev, opt];
        });
    };

    return (
        <div className="min-h-[calc(100dvh)] bg-neutral-50 p-5 text-neutral-900 sm:px-40 sm:py-10">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <SubHeader title="JSearch" />
                    <p className="text-xs text-neutral-500 sm:max-w-md sm:text-right text-nowrap">
                        Powered by{" "}
                        <a
                            href="https://www.openwebninja.com/api/jsearch/docs#GET/search"
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-emerald-600"
                        >
                            OpenWeb Ninja JSearch
                        </a>
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <div className="h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-17">
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search query (title + location works best)"
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                            />
                            <Select<Option, false>
                                options={COUNTRY_OPTIONS}
                                value={country}
                                onChange={(o) => setCountry(o)}
                                isClearable
                                isSearchable
                                placeholder="Country"
                                styles={selectStylesSingle}
                            />
                            <Select<Option, false>
                                options={LANGUAGE_OPTIONS}
                                value={language}
                                onChange={(o) => setLanguage(o)}
                                isClearable
                                isSearchable
                                placeholder="Language (optional)"
                                styles={selectStylesSingle}
                            />
                            <Select<Option, false>
                                options={DATE_POSTED_OPTIONS}
                                value={datePosted}
                                onChange={(o) => setDatePosted(o)}
                                isClearable={false}
                                placeholder="Date posted"
                                styles={selectStylesSingle}
                            />
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={remoteOnly}
                                    onChange={(e) =>
                                        setRemoteOnly(e.target.checked)
                                    }
                                    className="h-4 w-4 rounded border border-neutral-300 accent-emerald-600"
                                />
                                Remote / work from home only
                            </label>
                            <div className="border-t border-neutral-200 pt-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    Employment type
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {EMPLOYMENT_TYPES.map((opt) => {
                                        const active = employmentSel.some(
                                            (s) => s.value === opt.value,
                                        );
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() =>
                                                    toggleEmployment(opt)
                                                }
                                                className={filterPillClass(
                                                    active,
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="border-t border-neutral-200 pt-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    Experience
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {JOB_REQUIREMENTS.map((opt) => {
                                        const active = requirementsSel.some(
                                            (s) => s.value === opt.value,
                                        );
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() =>
                                                    toggleRequirement(opt)
                                                }
                                                className={filterPillClass(
                                                    active,
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={radiusKm}
                                onChange={(e) => setRadiusKm(e.target.value)}
                                placeholder="Radius from query location (km, optional)"
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                            />
                            <input
                                type="text"
                                value={excludePublishers}
                                onChange={(e) =>
                                    setExcludePublishers(e.target.value)
                                }
                                placeholder="Exclude publishers (comma-separated, optional)"
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                            />
                            <button
                                type="button"
                                onClick={resetFilters}
                                className=" rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <div className="sticky top-17 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                            <p className="text-sm text-neutral-600">
                                Job search
                                {debouncedQuery.trim()
                                    ? ` · “${debouncedQuery.trim()}”`
                                    : ""}
                                {country ? ` · ${country.label}` : ""}
                            </p>
                            {loading && (
                                <p className="text-sm text-neutral-500">
                                    Loading…
                                </p>
                            )}
                            {!loading && error && (
                                <p className="text-sm text-red-600">{error}</p>
                            )}
                            {!loading && !error && payload && (
                                <p className="text-sm text-neutral-600">
                                    Page {page}
                                    {jobs.length > 0
                                        ? ` · ${jobs.length} result${
                                              jobs.length === 1 ? "" : "s"
                                          } on this page`
                                        : " · no results"}
                                    {jobs.length >= JOBS_PER_PAGE_HINT
                                        ? " · there may be more on the next page"
                                        : ""}
                                </p>
                            )}
                            {!loading && !error && payload && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPage((p) => Math.max(1, p - 1))
                                        }
                                        disabled={!canGoPrev}
                                        className=" rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPage((p) => p + 1)
                                        }
                                        disabled={!canGoNext}
                                        className=" rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>

                        {!loading && !error && jobs.length > 0 && (
                            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                                {jobs.map((job, index) => {
                                    const id =
                                        job.job_id?.trim() ??
                                        `row-${index}`;
                                    const href = jobCardHref(job);
                                    const locParts = [
                                        job.job_city,
                                        job.job_state,
                                        job.job_country,
                                    ].filter(Boolean);
                                    const loc =
                                        job.job_location?.trim() ||
                                        (locParts.length > 0
                                            ? locParts.join(", ")
                                            : null);
                                    const rawDesc = job.job_description?.trim();
                                    const preview = rawDesc
                                        ? stripHtml(rawDesc)
                                        : "";

                                    const cardClassName =
                                        "block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 text-left transition-all duration-200 hover:border-emerald-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2";

                                    const inner = (
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                            <JSearchCompanyAvatar
                                                logoSrc={
                                                    job.employer_logo?.trim() ||
                                                    null
                                                }
                                                companyName={
                                                    job.employer_name?.trim() ||
                                                    "Company"
                                                }
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-neutral-900">
                                                    {job.job_title?.trim() ||
                                                        "Untitled role"}
                                                </p>
                                                <p className="text-sm text-neutral-600">
                                                    {job.employer_name?.trim() ||
                                                        "—"}
                                                    {job.job_publisher
                                                        ? ` · ${job.job_publisher}`
                                                        : ""}
                                                    {job.job_employment_type
                                                        ? ` · ${job.job_employment_type}`
                                                        : ""}
                                                    {loc ? ` · ${loc}` : ""}
                                                    {job.job_is_remote === true
                                                        ? " · Remote"
                                                        : ""}
                                                </p>
                                                {preview ? (
                                                    <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-neutral-700">
                                                        {preview}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    );

                                    return href ? (
                                        <a
                                            key={id}
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={cardClassName}
                                        >
                                            {inner}
                                        </a>
                                    ) : (
                                        <div key={id} className={cardClassName}>
                                            {inner}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
