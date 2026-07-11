import { useEffect, useLayoutEffect, useRef, useState } from "react";
import axios from "axios";
import moment from "moment";
import Select from "react-select";
import SubHeader from "../../components/SubHeader";
import PortalJobCard from "../../components/PortalJobCard";
import { selectStyles } from "../../lib/multiSelectStyles";

const FILTER_DEBOUNCE_MS = 500;

type LocationOption = {
    value: string;
    label: string;
};

/** SerpAPI `location` uses full country names; order matches Adzuna */
const SERP_LOCATION_BY_CODE: Record<string, string> = {
    au: "Australia",
    at: "Austria",
    be: "Belgium",
    br: "Brazil",
    ca: "Canada",
    fr: "France",
    de: "Germany",
    in: "India",
    it: "Italy",
    mx: "Mexico",
    nl: "Netherlands",
    nz: "New Zealand",
    pl: "Poland",
    sg: "Singapore",
    za: "South Africa",
    es: "Spain",
    ch: "Switzerland",
    gb: "United Kingdom",
    us: "United States",
};

const ADZUNA_COUNTRY_CODE_ORDER = [
    "au",
    "at",
    "be",
    "br",
    "ca",
    "fr",
    "de",
    "in",
    "it",
    "mx",
    "nl",
    "nz",
    "pl",
    "sg",
    "za",
    "es",
    "ch",
    "gb",
    "us",
] as const;

const GOOGLE_JOBS_LOCATION_OPTIONS: LocationOption[] =
    ADZUNA_COUNTRY_CODE_ORDER.map((code) => {
        const name = SERP_LOCATION_BY_CODE[code];
        return { value: name, label: name };
    });

const DEFAULT_COUNTRY_CODE = "gb";

function getDefaultGoogleJobsLocationOption(): LocationOption {
    const browserTimezone =
        typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() ??
              ""
            : "";
    const browserLocale =
        typeof navigator !== "undefined" ? navigator.language : "";
    const localeForMoment = browserLocale || moment.locale();
    const normalizedLocale = moment.locale(localeForMoment).toLowerCase();
    const timezoneToCountryCode: Record<string, string> = {
        "asia/kolkata": "in",
        "europe/london": "gb",
        "america/new_york": "us",
        "america/chicago": "us",
        "america/denver": "us",
        "america/los_angeles": "us",
        "america/toronto": "ca",
        "europe/paris": "fr",
        "europe/berlin": "de",
        "europe/rome": "it",
        "europe/madrid": "es",
        "europe/amsterdam": "nl",
        "europe/warsaw": "pl",
        "europe/zurich": "ch",
        "australia/sydney": "au",
        "pacific/auckland": "nz",
        "asia/singapore": "sg",
        "africa/johannesburg": "za",
        "america/mexico_city": "mx",
        "america/sao_paulo": "br",
        "europe/brussels": "be",
        "europe/vienna": "at",
    };
    const localeParts = normalizedLocale.split(/[-_]/);
    const regionFromTimezone = timezoneToCountryCode[browserTimezone] ?? "";
    const regionFromMoment = localeParts.length > 1 ? localeParts[1] : "";
    const regionFromBrowser =
        browserLocale.split(/[-_]/)[1]?.toLowerCase() ?? "";
    const countryCode =
        regionFromTimezone ||
        regionFromMoment ||
        regionFromBrowser ||
        DEFAULT_COUNTRY_CODE;

    const locationName =
        SERP_LOCATION_BY_CODE[countryCode] ??
        SERP_LOCATION_BY_CODE[DEFAULT_COUNTRY_CODE];

    return (
        GOOGLE_JOBS_LOCATION_OPTIONS.find((o) => o.value === locationName) ??
        GOOGLE_JOBS_LOCATION_OPTIONS.find(
            (o) => o.value === SERP_LOCATION_BY_CODE[DEFAULT_COUNTRY_CODE],
        ) ??
        GOOGLE_JOBS_LOCATION_OPTIONS[0]
    );
}

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

/** Fixed UI filters only — query strings follow Google Jobs-style refinements */
type StaticFilterKey =
    | "quick:no-degree"
    | "quick:remote"
    | "job:full-time"
    | "job:part-time"
    | "job:contract"
    | "job:internship"
    | "date:yesterday"
    | "date:last-3-days"
    | "date:last-week"
    | "date:last-month";

const STATIC_FILTER_LABELS: Record<StaticFilterKey, string> = {
    "quick:no-degree": "No degree",
    "quick:remote": "Remote",
    "job:full-time": "Full time",
    "job:part-time": "Part time",
    "job:contract": "Contract",
    "job:internship": "Internship",
    "date:yesterday": "Yesterday",
    "date:last-3-days": "Last 3 days",
    "date:last-week": "Last week",
    "date:last-month": "Last month",
};

function buildSerpQuery(
    baseKeyword: string,
    filter: StaticFilterKey | null,
): string {
    const base = baseKeyword.trim() || "Software Engineer";
    if (filter == null) return base;

    const suffix: Record<StaticFilterKey, string> = {
        "quick:no-degree": `${base} no degree`,
        "quick:remote": `${base} remote`,
        "job:full-time": `${base} full time`,
        "job:part-time": `${base} part time`,
        "job:contract": `${base} contract`,
        "job:internship": `${base} internship`,
        "date:yesterday": `${base} since yesterday`,
        "date:last-3-days": `${base} in the last 3 days`,
        "date:last-week": `${base} in the last week`,
        "date:last-month": `${base} in the last month`,
    };

    return suffix[filter];
}

type GoogleJobsJobResult = {
    title?: string;
    company_name?: string;
    location?: string;
    via?: string;
    thumbnail?: string;
    extensions?: string[];
    detected_extensions?: Record<string, unknown>;
    source_link?: string;
    share_link?: string;
    description?: string;
    apply_options?: Array<{ title?: string; link?: string }>;
    job_id?: string;
};

function getSalaryDisplay(job: GoogleJobsJobResult): string | null {
    const d = job.detected_extensions;
    if (d && typeof d === "object" && d.salary != null) {
        const s = String(d.salary).trim();
        if (s !== "") return s;
    }
    const ext = job.extensions ?? [];
    for (const tag of ext) {
        const t = tag.trim();
        if (!t || !/\d/.test(t)) continue;
        if (
            /\bK\b/i.test(t) ||
            /\$|£|€/.test(t) ||
            /\/hr|per\s+hour|per\s+year|a\s+year/i.test(t) ||
            (/–|—|-/.test(t) && /\d/.test(t))
        ) {
            return t;
        }
    }
    return null;
}

function getExtensionTagsForPills(job: GoogleJobsJobResult): string[] {
    const salaryLine = getSalaryDisplay(job);
    const ext = job.extensions ?? [];
    return ext.filter((tag) => {
        const t = tag.trim();
        if (!t) return false;
        if (salaryLine && t === salaryLine) return false;
        return true;
    });
}

function getApplyPills(
    job: GoogleJobsJobResult,
): Array<{ title: string; link: string }> {
    const seen = new Set<string>();
    const out: Array<{ title: string; link: string }> = [];

    const candidates = job.apply_options ?? [];
    for (const opt of candidates) {
        const link = opt.link?.trim();
        if (!link || seen.has(link)) continue;
        seen.add(link);
        out.push({
            title: (opt.title?.trim() || "Apply").slice(0, 48),
            link,
        });
    }

    if (out.length === 0) {
        const fallback =
            job.source_link?.trim() ?? job.share_link?.trim() ?? "";
        if (fallback) {
            out.push({ title: "Apply", link: fallback });
        }
    }

    return out;
}

type GoogleJobsSerpResponse = {
    search_metadata?: { status?: string; google_jobs_url?: string };
    search_parameters?: {
        q?: string;
        engine?: string;
        location_requested?: string;
        location_used?: string;
        google_domain?: string;
    };
    jobs_results?: GoogleJobsJobResult[];
    serpapi_pagination?: {
        next_page_token?: string;
        next?: string;
    };
};

type JobsResponseBody = {
    success?: boolean;
    error?: string;
    data?: GoogleJobsSerpResponse;
};

const QUICK_FILTERS: StaticFilterKey[] = ["quick:no-degree", "quick:remote"];

const JOB_TYPE_FILTERS: StaticFilterKey[] = [
    "job:full-time",
    "job:part-time",
    "job:contract",
    "job:internship",
];

const DATE_POSTED_FILTERS: StaticFilterKey[] = [
    "date:yesterday",
    "date:last-3-days",
    "date:last-week",
    "date:last-month",
];

export default function GoogleJobs() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [jobKeyword, setJobKeyword] = useState("Software Engineer");
    const [selectedLocation, setSelectedLocation] =
        useState<LocationOption>(getDefaultGoogleJobsLocationOption);

    const [activeStaticFilter, setActiveStaticFilter] =
        useState<StaticFilterKey | null>(null);

    const debouncedKeyword = useDebouncedValue(jobKeyword, FILTER_DEBOUNCE_MS);
    const debouncedLocation = useDebouncedValue(
        selectedLocation.value,
        FILTER_DEBOUNCE_MS,
    );

    const [pageIndex, setPageIndex] = useState(0);
    const [nextTokenTrail, setNextTokenTrail] = useState<string[]>([]);
    const nextTokenTrailRef = useRef<string[]>([]);
    useEffect(() => {
        nextTokenTrailRef.current = nextTokenTrail;
    }, [nextTokenTrail]);

    const [payload, setPayload] = useState<GoogleJobsSerpResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const effectiveQ = buildSerpQuery(debouncedKeyword, activeStaticFilter);

    const searchSignature = `${effectiveQ}|${debouncedLocation.trim() || selectedLocation.value}`;

    useLayoutEffect(() => {
        setPageIndex(0);
        setNextTokenTrail([]);
    }, [searchSignature]);

    useEffect(() => {
        const ctrl = new AbortController();

        if (pageIndex > 0) {
            const needed = nextTokenTrailRef.current[pageIndex - 1];
            if (!needed) return undefined;
        }

        void (async () => {
            setLoading(true);
            setError(null);
            try {
                const params: Record<string, string | undefined> = {
                    q: effectiveQ,
                    location:
                        debouncedLocation.trim() || selectedLocation.value,
                };

                if (pageIndex > 0) {
                    const token =
                        nextTokenTrailRef.current[pageIndex - 1];
                    if (!token) {
                        throw new Error("Missing pagination token");
                    }
                    params.next_page_token = token;
                }

                const response = await axios.get<JobsResponseBody>(
                    `${backendUrl}/serp/jobs`,
                    {
                        signal: ctrl.signal,
                        params,
                    },
                );

                if (!response.data.success && response.data.error) {
                    throw new Error(response.data.error);
                }

                const data = response.data.data;
                if (!data) {
                    throw new Error("Empty response");
                }

                const nextTok =
                    data.serpapi_pagination?.next_page_token ?? "";

                setNextTokenTrail((prev) => {
                    const copy = [...prev];
                    copy[pageIndex] = nextTok;
                    return copy;
                });

                setPayload(data);
            } catch (err: unknown) {
                if (axios.isCancel(err)) return;
                const message =
                    err instanceof Error
                        ? err.message
                        : "Could not load Google Jobs";
                setError(message);
                setPayload(null);
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        })();

        return () => ctrl.abort();
    }, [
        backendUrl,
        debouncedLocation,
        effectiveQ,
        pageIndex,
        searchSignature,
    ]);

    const toggleStaticFilter = (key: StaticFilterKey) => {
        setActiveStaticFilter((prev) => (prev === key ? null : key));
    };

    const clearStaticFilter = () => setActiveStaticFilter(null);

    const filterPillClass = (key: StaticFilterKey) =>
        `rounded-full border px-3 py-1 text-xs transition  ${
            activeStaticFilter === key
                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
        }`;

    const canGoPrev = pageIndex > 0 && !loading;
    const nextForCurrentPage =
        nextTokenTrail[pageIndex] != null && nextTokenTrail[pageIndex] !== "";
    const canGoNext = !loading && Boolean(nextForCurrentPage);

    return (
        <div className="min-h-[calc(100dvh)] bg-neutral-50 p-5 text-neutral-900 sm:px-40 sm:py-10">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3">
                    <SubHeader title="Google Jobs" />
                </div>

                <div className="grid lg:grid-cols-5 grid-cols-1 gap-3">
                    <div className="h-fit rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] lg:sticky lg:top-20">
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={jobKeyword}
                                onChange={(e) => setJobKeyword(e.target.value)}
                                placeholder="Job title or keywords"
                                className="cmn-field"
                            />
                            <div>
                                <Select<LocationOption>
                                    options={GOOGLE_JOBS_LOCATION_OPTIONS}
                                    value={selectedLocation}
                                    onChange={(option) => {
                                        if (option) setSelectedLocation(option);
                                    }}
                                    isSearchable
                                    placeholder="Select country"
                                    styles={selectStyles}
                                />
                            </div>
                            {activeStaticFilter != null && (
                                <p className="text-xs text-neutral-500">
                                    Active filter:{" "}
                                    <span className="text-neutral-800">
                                        {
                                            STATIC_FILTER_LABELS[
                                                activeStaticFilter
                                            ]
                                        }
                                    </span>
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setJobKeyword("Software Engineer");
                                    setSelectedLocation(
                                        getDefaultGoogleJobsLocationOption(),
                                    );
                                    clearStaticFilter();
                                }}
                                className=" rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                                Reset search
                            </button>
                        </div>

                        <div className="mt-4 border-t border-neutral-200 pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Quick filters
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {QUICK_FILTERS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleStaticFilter(key)}
                                        className={filterPillClass(key)}
                                    >
                                        {STATIC_FILTER_LABELS[key]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 border-t border-neutral-200 pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Job type
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {JOB_TYPE_FILTERS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleStaticFilter(key)}
                                        className={filterPillClass(key)}
                                    >
                                        {STATIC_FILTER_LABELS[key]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 border-t border-neutral-200 pt-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                Date posted
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {DATE_POSTED_FILTERS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleStaticFilter(key)}
                                        className={filterPillClass(key)}
                                    >
                                        {STATIC_FILTER_LABELS[key]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeStaticFilter != null && (
                            <button
                                type="button"
                                onClick={clearStaticFilter}
                                className="mt-4 w-full  rounded border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>

                    <div className="lg:col-span-4 col-span-1 flex flex-col gap-3">
                        <div className="sticky top-20 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                            <p className="text-sm text-neutral-600">
                                {payload?.search_parameters?.q ?? effectiveQ}
                                {" · "}
                                {payload?.search_parameters?.location_used ??
                                    (debouncedLocation.trim() ||
                                        selectedLocation.value)}
                            </p>
                            {loading && (
                                <p className="text-sm text-neutral-500">Loading…</p>
                            )}
                            {!loading && error && (
                                <p className="text-sm text-red-600">{error}</p>
                            )}
                            {!loading && !error && payload?.jobs_results && (
                                <p className="text-sm text-neutral-600">
                                    {payload.jobs_results.length} jobs on this page (page{" "}
                                    {pageIndex + 1})
                                </p>
                            )}
                            {!loading && !error && payload && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPageIndex((prev) =>
                                                Math.max(0, prev - 1),
                                            )
                                        }
                                        disabled={!canGoPrev}
                                        className="rounded-lg  border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPageIndex((prev) => prev + 1)}
                                        disabled={!canGoNext}
                                        className="rounded-lg  border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                    {!nextForCurrentPage &&
                                        !loading &&
                                        payload?.jobs_results &&
                                        payload.jobs_results.length > 0 && (
                                            <span className="text-xs text-neutral-500">
                                                End of results
                                            </span>
                                        )}
                                </div>
                            )}
                        </div>

                        {!loading && !error && payload?.jobs_results && (
                            <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                {payload.jobs_results.map((job, index) => (
                                    <PortalJobCard
                                        key={
                                            job.job_id ??
                                            `${job.title ?? "job"}-${index}`
                                        }
                                        title={job.title}
                                        company={job.company_name}
                                        location={job.location}
                                        salary={getSalaryDisplay(job)}
                                        description={job.description}
                                        logoUrl={job.thumbnail}
                                        via={job.via}
                                        tags={getExtensionTagsForPills(job)}
                                        applyLinks={getApplyPills(job)}
                                        href={
                                            job.source_link ?? job.share_link
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
