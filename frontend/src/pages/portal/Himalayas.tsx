import { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import Select, { type StylesConfig } from "react-select";
import SubHeader from "../../components/SubHeader";

const FILTER_DEBOUNCE_MS = 500;

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
    { value: "AU", label: "Australia" },
    { value: "AT", label: "Austria" },
    { value: "BE", label: "Belgium" },
    { value: "BR", label: "Brazil" },
    { value: "CA", label: "Canada" },
    { value: "FR", label: "France" },
    { value: "DE", label: "Germany" },
    { value: "IN", label: "India" },
    { value: "IT", label: "Italy" },
    { value: "MX", label: "Mexico" },
    { value: "NL", label: "Netherlands" },
    { value: "NZ", label: "New Zealand" },
    { value: "PL", label: "Poland" },
    { value: "SG", label: "Singapore" },
    { value: "ZA", label: "South Africa" },
    { value: "ES", label: "Spain" },
    { value: "CH", label: "Switzerland" },
    { value: "GB", label: "United Kingdom" },
    { value: "US", label: "United States" },
];

const SENIORITY_OPTIONS: Option[] = [
    { value: "Entry-level", label: "Entry-level" },
    { value: "Mid-level", label: "Mid-level" },
    { value: "Senior", label: "Senior" },
    { value: "Manager", label: "Manager" },
    { value: "Director", label: "Director" },
    { value: "Executive", label: "Executive" },
];

const EMPLOYMENT_OPTIONS: Option[] = [
    { value: "Full Time", label: "Full Time" },
    { value: "Part Time", label: "Part Time" },
    { value: "Contractor", label: "Contractor" },
    { value: "Temporary", label: "Temporary" },
    { value: "Intern", label: "Intern" },
    { value: "Volunteer", label: "Volunteer" },
    { value: "Other", label: "Other" },
];

const SORT_OPTIONS: Option[] = [
    { value: "relevant", label: "Relevant" },
    { value: "recent", label: "Most recent" },
    { value: "salaryDesc", label: "Salary (high to low)" },
    { value: "salaryAsc", label: "Salary (low to high)" },
    { value: "nameAToZ", label: "Company A–Z" },
    { value: "nameZToA", label: "Company Z–A" },
    { value: "jobs", label: "Most jobs per company" },
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatPubDate(ts: number | undefined): string {
    if (ts == null || Number.isNaN(ts)) return "N/A";
    const m = ts > 1e12 ? moment(ts) : moment.unix(ts);
    return m.isValid() ? m.fromNow() : "N/A";
}

function salaryLine(
    min: number | null | undefined,
    max: number | null | undefined,
    currency: string | undefined,
): string {
    const cur = currency?.trim() || "";
    if (min != null && max != null) {
        const a = Math.round(min).toLocaleString();
        const b = Math.round(max).toLocaleString();
        return cur ? `${cur} ${a} – ${b}` : `${a} – ${b}`;
    }
    if (min != null) {
        const a = Math.round(min).toLocaleString();
        return cur ? `${cur} ${a}+` : `${a}+`;
    }
    if (max != null) {
        const b = Math.round(max).toLocaleString();
        return cur ? `Up to ${cur} ${b}` : `Up to ${b}`;
    }
    return "Salary not listed";
}

type HimalayasJob = {
    title?: string;
    excerpt?: string;
    companyName?: string;
    companySlug?: string;
    companyLogo?: string;
    employmentType?: string;
    minSalary?: number | null;
    maxSalary?: number | null;
    currency?: string;
    locationRestrictions?: string[];
    timezoneRestrictions?: number[];
    categories?: string[];
    parentCategories?: string[];
    seniority?: string[];
    description?: string;
    pubDate?: number;
    applicationLink?: string;
    guid?: string;
};

type JobsBody = {
    jobs?: HimalayasJob[];
    totalCount?: number;
    limit?: number;
    offset?: number;
};

type ApiResponse = {
    success?: boolean;
    error?: string;
    data?: JobsBody;
};

export default function Himalayas() {
    const [keyword, setKeyword] = useState("");
    const [country, setCountry] = useState<Option | null>(null);
    const [worldwideOnly, setWorldwideOnly] = useState(false);
    const [excludeWorldwide, setExcludeWorldwide] = useState(false);
    const [seniorities, setSeniorities] = useState<Option[]>([]);
    const [employmentTypes, setEmploymentTypes] = useState<Option[]>([]);
    const [companySlug, setCompanySlug] = useState("");
    const [timezone, setTimezone] = useState("");
    const [sort, setSort] = useState<string>("recent");
    const [page, setPage] = useState(1);

    const [payload, setPayload] = useState<JobsBody | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debouncedKeyword = useDebouncedValue(keyword, FILTER_DEBOUNCE_MS);
    const debouncedCompany = useDebouncedValue(companySlug, FILTER_DEBOUNCE_MS);
    const debouncedTz = useDebouncedValue(timezone, FILTER_DEBOUNCE_MS);

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        setPage(1);
    }, [
        debouncedKeyword,
        country,
        worldwideOnly,
        excludeWorldwide,
        seniorities,
        employmentTypes,
        debouncedCompany,
        debouncedTz,
        sort,
    ]);

    useEffect(() => {
        const ctrl = new AbortController();

        void (async () => {
            setLoading(true);
            setError(null);
            try {
                const params: Record<string, string | number | boolean> = {
                    page,
                    sort,
                };
                const q = debouncedKeyword.trim();
                if (q) params.q = q;
                if (country?.value) params.country = country.value;
                if (worldwideOnly) params.worldwide = true;
                if (country?.value && excludeWorldwide) {
                    params.exclude_worldwide = true;
                }
                if (seniorities.length > 0) {
                    params.seniority = seniorities.map((s) => s.value).join(",");
                }
                if (employmentTypes.length > 0) {
                    params.employment_type = employmentTypes
                        .map((s) => s.value)
                        .join(",");
                }
                const co = debouncedCompany.trim();
                if (co) params.company = co;
                const tz = debouncedTz.trim();
                if (tz) params.timezone = tz;

                const response = await axios.get<ApiResponse>(
                    `${backendUrl}/himalayas/jobs/search`,
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
                        : "Could not load Himalayas jobs";
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
        debouncedKeyword,
        country,
        worldwideOnly,
        excludeWorldwide,
        seniorities,
        employmentTypes,
        debouncedCompany,
        debouncedTz,
        sort,
    ]);

    const jobs = payload?.jobs ?? [];
    const limit = payload?.limit ?? 20;
    const totalCount = payload?.totalCount ?? 0;
    const totalPages =
        totalCount > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;
    const canGoPrev = page > 1 && !loading;
    const canGoNext = !loading && page < totalPages && jobs.length > 0;

    const resetFilters = () => {
        setKeyword("");
        setCountry(null);
        setWorldwideOnly(false);
        setExcludeWorldwide(false);
        setSeniorities([]);
        setEmploymentTypes([]);
        setCompanySlug("");
        setTimezone("");
        setSort("recent");
        setPage(1);
    };

    const toggleSeniority = (opt: Option) => {
        setSeniorities((prev) => {
            const exists = prev.some((p) => p.value === opt.value);
            if (exists) return prev.filter((p) => p.value !== opt.value);
            return [...prev, opt];
        });
    };

    const toggleEmployment = (opt: Option) => {
        setEmploymentTypes((prev) => {
            const exists = prev.some((p) => p.value === opt.value);
            if (exists) return prev.filter((p) => p.value !== opt.value);
            return [...prev, opt];
        });
    };

    return (
        <div className="min-h-[calc(100dvh)] bg-neutral-50 p-5 text-neutral-900 sm:px-40 sm:py-10">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <SubHeader title="Himalayas" />
                    <p className="text-xs text-neutral-500 sm:max-w-md sm:text-right text-nowrap">
                        Listings from the{" "}
                        <a
                            href="https://himalayas.app/docs/remote-jobs-api"
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-emerald-600"
                        >
                            Himalayas remote jobs API
                        </a>
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <div className="h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-17">
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Keywords (optional)"
                                className="w-full text-no rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
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
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={worldwideOnly}
                                    onChange={(e) =>
                                        setWorldwideOnly(e.target.checked)
                                    }
                                    className="h-4 w-4 rounded border border-neutral-300 accent-emerald-600"
                                />
                                Worldwide-friendly only
                            </label>
                            {country != null ? (
                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                    <input
                                        type="checkbox"
                                        checked={excludeWorldwide}
                                        onChange={(e) =>
                                            setExcludeWorldwide(e.target.checked)
                                        }
                                        className="h-4 w-4 rounded border border-neutral-300 accent-emerald-600"
                                    />
                                    Exclude worldwide matches for this country
                                </label>
                            ) : null}
                            <div className="border-t border-neutral-200 pt-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    Seniority
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {SENIORITY_OPTIONS.map((opt) => {
                                        const active = seniorities.some(
                                            (s) => s.value === opt.value,
                                        );
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() =>
                                                    toggleSeniority(opt)
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
                                    Employment type
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {EMPLOYMENT_OPTIONS.map((opt) => {
                                        const active = employmentTypes.some(
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
                            <input
                                type="text"
                                value={companySlug}
                                onChange={(e) => setCompanySlug(e.target.value)}
                                placeholder="Company slug (e.g. linear)"
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                            />
                            <input
                                type="text"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                placeholder="Timezone (e.g. UTC-5)"
                                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                            />
                            <div className="border-t border-neutral-200 pt-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    Sort by
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {SORT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSort(opt.value)}
                                            className={filterPillClass(
                                                sort === opt.value,
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
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
                                Remote jobs
                                {debouncedKeyword.trim()
                                    ? ` · “${debouncedKeyword.trim()}”`
                                    : ""}
                                {country
                                    ? ` · ${country.label}`
                                    : ""}
                                {worldwideOnly ? " · worldwide-friendly" : ""}
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
                                    {totalCount.toLocaleString()} total · page{" "}
                                    {page} of {totalPages} · {jobs.length} on this
                                    page
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
                                    const rawSummary =
                                        job.excerpt?.trim() ||
                                        (job.description
                                            ? stripHtml(job.description)
                                            : "");
                                    const truncated = rawSummary.length > 280;
                                    const snippet = rawSummary.slice(0, 280);
                                    const loc =
                                        job.locationRestrictions?.join(", ") ??
                                        "Location not specified";
                                    const applyUrl =
                                        job.applicationLink?.trim() ||
                                        job.guid ||
                                        "#";

                                    return (
                                        <a
                                            key={
                                                job.guid ??
                                                `${job.title ?? "job"}-${index}`
                                            }
                                            href={applyUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 transition-all duration-200 hover:border-emerald-400 hover:bg-white"
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                                {job.companyLogo ? (
                                                    <img
                                                        src={job.companyLogo}
                                                        alt=""
                                                        className="h-12 w-12 shrink-0 rounded-md border border-neutral-200 object-contain"
                                                    />
                                                ) : null}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <h3 className="text-base font-semibold text-neutral-900">
                                                                {job.title ??
                                                                    "Untitled role"}
                                                            </h3>
                                                            <p className="mt-1 text-sm text-neutral-600">
                                                                {job.companyName ??
                                                                    "Company"}{" "}
                                                                · {loc}
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-sm text-green-700 sm:text-right">
                                                            {salaryLine(
                                                                job.minSalary,
                                                                job.maxSalary,
                                                                job.currency,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <p className="mt-2 text-sm text-neutral-600">
                                                        {snippet
                                                            ? `${snippet}${truncated ? "…" : ""}`
                                                            : "No summary"}
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                                                        <span>
                                                            Type:{" "}
                                                            {job.employmentType ??
                                                                "—"}
                                                        </span>
                                                        <span>
                                                            Posted:{" "}
                                                            {formatPubDate(
                                                                job.pubDate,
                                                            )}
                                                        </span>
                                                        {job.seniority &&
                                                        job.seniority.length >
                                                            0 ? (
                                                            <span>
                                                                {job.seniority.join(
                                                                    ", ",
                                                                )}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {job.categories &&
                                                    job.categories.length >
                                                        0 ? (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {job.categories
                                                                .slice(0, 8)
                                                                .map((c) => (
                                                                    <span
                                                                        key={c}
                                                                        className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
                                                                    >
                                                                        {c.replace(
                                                                            /-/g,
                                                                            " ",
                                                                        )}
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        )}

                        {!loading && !error && jobs.length === 0 && payload && (
                            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-white text-sm text-neutral-600">
                                No jobs match these filters.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
