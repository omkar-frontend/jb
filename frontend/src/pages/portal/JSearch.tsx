import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../../lib/api";
import Select from "react-select";
import SubHeader from "../../components/SubHeader";
import PortalJobCard from "../../components/PortalJobCard";
import { Checkbox } from "@/components/ui/checkbox";
import { selectStyles } from "../../lib/multiSelectStyles";

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

type JSearchApplyOption = {
    apply_link?: string;
    is_direct?: boolean;
    publisher?: string;
};

type JSearchJob = {
    job_id?: string;
    job_title?: string;
    employer_name?: string;
    employer_logo?: string;
    employer_website?: string;
    job_publisher?: string;
    job_employment_type?: string | null;
    job_employment_types?: string[];
    job_apply_link?: string;
    apply_options?: JSearchApplyOption[];
    job_google_link?: string;
    job_description?: string;
    job_city?: string;
    job_state?: string;
    job_country?: string;
    job_location?: string;
    job_is_remote?: boolean | null;
    job_posted_at?: string | null;
    job_salary?: string | null;
    job_salary_string?: string | null;
    job_min_salary?: number | null;
    job_max_salary?: number | null;
    job_salary_period?: string | null;
    job_benefits_strings?: string[];
};

function formatJobType(job: JSearchJob): string | null {
    const single = job.job_employment_type?.trim();
    if (single) return single;
    const types = (job.job_employment_types ?? [])
        .map((t) => t.trim())
        .filter(Boolean);
    return types.length > 0 ? types.join(", ") : null;
}

function formatSalary(job: JSearchJob): string | null {
    const labeled = job.job_salary_string?.trim() || job.job_salary?.trim();
    if (labeled) return labeled;

    const min = job.job_min_salary;
    const max = job.job_max_salary;
    if (min == null && max == null) return null;

    const period = job.job_salary_period?.trim()
        ? ` / ${job.job_salary_period.trim().toLowerCase()}`
        : "";
    if (min != null && max != null) {
        return `${min.toLocaleString()} – ${max.toLocaleString()}${period}`;
    }
    if (min != null) return `From ${min.toLocaleString()}${period}`;
    return `Up to ${max!.toLocaleString()}${period}`;
}

function applyLinksForJob(job: JSearchJob) {
    const options = job.apply_options ?? [];
    const pills = options
        .map((opt) => {
            const link = opt.apply_link?.trim();
            if (!link) return null;
            const title = opt.publisher?.trim() || "Apply";
            return { title, link };
        })
        .filter((p): p is { title: string; link: string } => Boolean(p));

    if (pills.length > 0) return pills;

    const fallback = job.job_apply_link?.trim();
    if (fallback) {
        return [
            {
                title: job.job_publisher?.trim() || "Apply",
                link: fallback,
            },
        ];
    }
    return [];
}

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

function jobCardHref(job: JSearchJob): string | null {
    const apply = job.job_apply_link?.trim();
    if (apply) return apply;
    const google = job.job_google_link?.trim();
    if (google) return google;
    return null;
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

                const response = await api.get<SearchApiResponse>(
                    `/jsearch/search`,
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
                    <div className="h-fit rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] lg:sticky lg:top-20">
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search query (title + location works best)"
                                className="cmn-field"
                            />
                            <Select<Option, false>
                                options={COUNTRY_OPTIONS}
                                value={country}
                                onChange={(o) => setCountry(o)}
                                isClearable
                                isSearchable
                                placeholder="Country"
                                styles={selectStyles}
                            />
                            <Select<Option, false>
                                options={LANGUAGE_OPTIONS}
                                value={language}
                                onChange={(o) => setLanguage(o)}
                                isClearable
                                isSearchable
                                placeholder="Language (optional)"
                                styles={selectStyles}
                            />
                            <Select<Option, false>
                                options={DATE_POSTED_OPTIONS}
                                value={datePosted}
                                onChange={(o) => setDatePosted(o)}
                                isClearable={false}
                                placeholder="Date posted"
                                styles={selectStyles}
                            />
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <Checkbox
                                    checked={remoteOnly}
                                    onCheckedChange={(checked) =>
                                        setRemoteOnly(checked === true)
                                    }
                                    className="border-neutral-300 data-checked:border-emerald-600 data-checked:bg-emerald-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
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
                                className="cmn-field"
                            />
                            <input
                                type="text"
                                value={excludePublishers}
                                onChange={(e) =>
                                    setExcludePublishers(e.target.value)
                                }
                                placeholder="Exclude publishers (comma-separated, optional)"
                                className="cmn-field"
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
                        <div className="sticky top-20 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
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
                            <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                {jobs.map((job, index) => {
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
                                    const applyLinks = applyLinksForJob(job);
                                    const meta = [
                                        job.job_is_remote === true
                                            ? "Remote"
                                            : null,
                                    ].filter((m): m is string => Boolean(m));

                                    return (
                                        <PortalJobCard
                                            key={
                                                job.job_id?.trim() ??
                                                `row-${index}`
                                            }
                                            href={jobCardHref(job)}
                                            title={job.job_title}
                                            company={job.employer_name}
                                            location={loc}
                                            salary={formatSalary(job)}
                                            description={job.job_description}
                                            jobType={formatJobType(job)}
                                            postedAt={job.job_posted_at}
                                            logoUrl={job.employer_logo}
                                            via={job.job_publisher}
                                            tags={job.job_benefits_strings ?? []}
                                            meta={meta}
                                            applyLinks={applyLinks}
                                        />
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
