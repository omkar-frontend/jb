import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../../lib/api";
import moment from "moment";
import Select from "react-select";
import SubHeader from "../../components/SubHeader";
import PortalJobCard from "../../components/PortalJobCard";
import { Checkbox } from "@/components/ui/checkbox";
import { selectStyles } from "../../lib/multiSelectStyles";
import { usePageReset } from "../../hooks/usePageReset";

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

function formatPubDate(ts: number | undefined): string | null {
    if (ts == null || Number.isNaN(ts)) return null;
    const m = ts > 1e12 ? moment(ts) : moment.unix(ts);
    return m.isValid() ? m.fromNow() : null;
}

function salaryLine(
    min: number | null | undefined,
    max: number | null | undefined,
    currency: string | undefined,
): string | null {
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
    return null;
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

    const [payload, setPayload] = useState<JobsBody | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debouncedKeyword = useDebouncedValue(keyword, FILTER_DEBOUNCE_MS);
    const debouncedCompany = useDebouncedValue(companySlug, FILTER_DEBOUNCE_MS);
    const debouncedTz = useDebouncedValue(timezone, FILTER_DEBOUNCE_MS);


    const filterSignature = [
        debouncedKeyword,
        country,
        worldwideOnly,
        excludeWorldwide,
        seniorities.join(","),
        employmentTypes.join(","),
        debouncedCompany,
        debouncedTz,
        sort,
    ].join("|");

    const [page, setPage] = usePageReset(filterSignature, 1);

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

                const response = await api.get<ApiResponse>(
                    `/himalayas/jobs/search`,
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
                    <div className="h-fit rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] lg:sticky lg:top-20">
                        <div className="grid gap-3">
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Keywords (optional)"
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
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <Checkbox
                                    checked={worldwideOnly}
                                    onCheckedChange={(checked) =>
                                        setWorldwideOnly(checked === true)
                                    }
                                    className="border-neutral-300 data-checked:border-emerald-600 data-checked:bg-emerald-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                />
                                Worldwide-friendly only
                            </label>
                            {country != null ? (
                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                    <Checkbox
                                        checked={excludeWorldwide}
                                        onCheckedChange={(checked) =>
                                            setExcludeWorldwide(checked === true)
                                        }
                                        className="border-neutral-300 data-checked:border-emerald-600 data-checked:bg-emerald-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
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
                                className="cmn-field"
                            />
                            <input
                                type="text"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                placeholder="Timezone (e.g. UTC-5)"
                                className="cmn-field"
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
                        <div className="sticky top-20 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
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
                            <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                {jobs.map((job, index) => (
                                    <PortalJobCard
                                        key={
                                            job.guid ??
                                            `${job.title ?? "job"}-${index}`
                                        }
                                        href={
                                            job.applicationLink?.trim() ||
                                            job.guid
                                        }
                                        title={job.title}
                                        company={job.companyName}
                                        location={
                                            job.locationRestrictions?.join(
                                                ", ",
                                            ) ?? null
                                        }
                                        salary={salaryLine(
                                            job.minSalary,
                                            job.maxSalary,
                                            job.currency,
                                        )}
                                        description={
                                            job.excerpt?.trim() ||
                                            job.description
                                        }
                                        jobType={job.employmentType}
                                        postedAt={formatPubDate(job.pubDate)}
                                        logoUrl={job.companyLogo}
                                        meta={
                                            job.seniority &&
                                            job.seniority.length > 0
                                                ? [job.seniority.join(", ")]
                                                : []
                                        }
                                        tags={job.categories ?? []}
                                    />
                                ))}
                            </div>
                        )}

                        {!loading && !error && jobs.length === 0 && payload && (
                            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#e6e6e6]/75 bg-white text-sm text-neutral-600 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                No jobs match these filters.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
