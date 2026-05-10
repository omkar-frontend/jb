import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import CreatableSelect from "react-select/creatable";
import type { StylesConfig } from "react-select";
import SubHeader from "../../components/SubHeader";

const FILTER_DEBOUNCE_MS = 500;
const DEFAULT_LIMIT = 20;
/** Ask upstream for many rows; Remotive’s public API often caps the response (~20). */
const REMOTIVE_UPSTREAM_LIMIT = "500";

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

type SharedSelectOption = {
    value: string;
    label: string;
};

const commonSelectStyles: StylesConfig<SharedSelectOption, false> = {
    control: (base, state) => ({
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
    menu: (base) => ({
        ...base,
        backgroundColor: "#ffffff",
        border: "1px solid #e5e5e5",
        fontSize: "14px",
        borderRadius: "8px",
        boxShadow:
            "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "#f5f5f5" : "#ffffff",
        color: "#171717",
        fontSize: "14px",
    }),
    singleValue: (base) => ({
        ...base,
        color: "#171717",
        fontSize: "14px",
    }),
    input: (base) => ({
        ...base,
        color: "#171717",
        fontSize: "14px",
    }),
    placeholder: (base) => ({
        ...base,
        color: "#737373",
        fontSize: "14px",
    }),
    dropdownIndicator: (base) => ({
        ...base,
        color: "#737373",
    }),
    indicatorSeparator: (base) => ({
        ...base,
        backgroundColor: "#e5e5e5",
    }),
};

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Remotive blocks hotlinked logos from the browser; load via backend proxy. */
function getProxiedRemotiveLogoUrl(
    job: RemotiveJob,
    backendBase: string,
): string | null {
    const base = backendBase.replace(/\/$/, "");
    const id = job.id;
    if (id != null && /^\d+$/.test(String(id))) {
        return `${base}/remotive/job/${id}/logo`;
    }
    const logoRef = job.company_logo ?? job.company_logo_url;
    const m = logoRef?.match(/\/job\/(\d+)\/logo/i);
    if (m) return `${base}/remotive/job/${m[1]}/logo`;
    return null;
}

function RemotiveCompanyAvatar({
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

/** Remotive categories payload can list rows under `jobs` or as a bare array. */
function parseCategoryOptions(raw: unknown): SharedSelectOption[] {
    const candidates = (() => {
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === "object") {
            const o = raw as Record<string, unknown>;
            if (Array.isArray(o.jobs)) return o.jobs;
            if (Array.isArray(o.categories)) return o.categories;
        }
        return [];
    })();

    const out: SharedSelectOption[] = [];
    for (const item of candidates) {
        if (typeof item === "string" && item.trim()) {
            out.push({ value: item.trim(), label: item.trim() });
            continue;
        }
        if (item && typeof item === "object") {
            const o = item as Record<string, unknown>;
            const slug = o.slug != null ? String(o.slug).trim() : "";
            const name =
                o.name != null
                    ? String(o.name).trim()
                    : o.title != null
                      ? String(o.title).trim()
                      : "";
            const value = slug || name;
            const label = name || slug;
            if (value) out.push({ value, label: label || value });
        }
    }
    return out;
}

type RemotiveJob = {
    id?: number;
    url?: string;
    title?: string;
    company_name?: string;
    company_logo?: string;
    company_logo_url?: string;
    category?: string;
    tags?: string[];
    job_type?: string;
    publication_date?: string;
    candidate_required_location?: string;
    salary?: string;
    description?: string;
};

type RemotiveJobsBody = {
    jobs?: RemotiveJob[];
    "job-count"?: number;
    "total-job-count"?: number;
};

type JobsResponse = {
    success?: boolean;
    error?: string;
    data?: RemotiveJobsBody;
};

export default function Remotive() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [categoryOptions, setCategoryOptions] = useState<SharedSelectOption[]>(
        [],
    );
    const [categoriesError, setCategoriesError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] =
        useState<SharedSelectOption | null>(null);

    const [search, setSearch] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [limitStr, setLimitStr] = useState(String(DEFAULT_LIMIT));

    const debouncedSearch = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
    const debouncedCompany = useDebouncedValue(companyName, FILTER_DEBOUNCE_MS);

    const [jobsPayload, setJobsPayload] = useState<RemotiveJobsBody | null>(
        null,
    );
    const [jobsLoading, setJobsLoading] = useState(false);
    const [jobsError, setJobsError] = useState<string | null>(null);

    const limitNum = useMemo(() => {
        const n = Number.parseInt(limitStr, 10);
        if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
        return Math.min(n, 500);
    }, [limitStr]);

    useEffect(() => {
        const ctrl = new AbortController();
        (async () => {
            try {
                const res = await axios.get<{ success?: boolean; data?: unknown }>(
                    `${backendUrl}/remotive/remote-jobs/categories`,
                    { signal: ctrl.signal },
                );
                const opts = parseCategoryOptions(res.data?.data);
                setCategoryOptions(opts);
                setCategoriesError(null);
            } catch (e: unknown) {
                if (axios.isCancel(e)) return;
                setCategoriesError("Could not load categories — you can still type a category slug.");
                console.error(e);
            }
        })();
        return () => ctrl.abort();
    }, [backendUrl]);

    useEffect(() => {
        const ctrl = new AbortController();
        (async () => {
            setJobsLoading(true);
            setJobsError(null);
            try {
                const params: Record<string, string> = {
                    limit: REMOTIVE_UPSTREAM_LIMIT,
                };
                if (selectedCategory?.value.trim()) {
                    params.category = selectedCategory.value.trim();
                }
                if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
                if (debouncedCompany.trim()) {
                    params.company_name = debouncedCompany.trim();
                }

                const response = await axios.get<JobsResponse>(
                    `${backendUrl}/remotive/remote-jobs`,
                    {
                        signal: ctrl.signal,
                        params,
                    },
                );
                if (!response.data.success && response.data.error) {
                    setJobsError(response.data.error);
                    setJobsPayload(null);
                    return;
                }
                setJobsPayload(response.data?.data ?? null);
            } catch (error: unknown) {
                if (axios.isCancel(error)) return;
                const message =
                    axios.isAxiosError(error) &&
                    typeof error.response?.data?.error === "string"
                        ? error.response.data.error
                        : "Could not load jobs";
                setJobsError(message);
                setJobsPayload(null);
            } finally {
                if (!ctrl.signal.aborted) setJobsLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [
        backendUrl,
        selectedCategory,
        debouncedSearch,
        debouncedCompany,
    ]);

    const rawJobs = jobsPayload?.jobs ?? [];
    const displayJobs = useMemo(
        () => rawJobs.slice(0, limitNum),
        [rawJobs, limitNum],
    );
    const loadedCount = rawJobs.length;

    return (
        <div className="min-h-[calc(100dvh)] bg-neutral-50 p-5 text-neutral-900 sm:px-40 sm:py-10">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <SubHeader title="Remotive" />
                    <a
                        href="https://remotive.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-emerald-700 underline-offset-2 hover:underline"
                    >
                        remotive.com — remote jobs board
                    </a>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <div className="h-fit rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:sticky lg:top-17">
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-600">
                                    Category (slug or name)
                                </label>
                                <CreatableSelect<SharedSelectOption>
                                    options={categoryOptions}
                                    value={selectedCategory}
                                    onChange={(opt) => setSelectedCategory(opt)}
                                    isClearable
                                    isSearchable
                                    placeholder={
                                        categoriesError
                                            ? "Type a category (e.g. software-dev)"
                                            : "All categories"
                                    }
                                    formatCreateLabel={(input) => `Use “${input}”`}
                                    styles={commonSelectStyles}
                                />
                                {categoriesError && (
                                    <p className="mt-1 text-xs text-amber-700">
                                        {categoriesError}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-600">
                                    Search (title &amp; description)
                                </label>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="e.g. react, golang"
                                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-600">
                                    Company name (partial match)
                                </label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g. remotive"
                                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-600">
                                    Limit (max results)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={limitStr}
                                    onChange={(e) => setLimitStr(e.target.value)}
                                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setSearch("");
                                    setCompanyName("");
                                    setLimitStr(String(DEFAULT_LIMIT));
                                }}
                                className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                            {jobsLoading && (
                                <p className="text-sm text-neutral-500">Loading…</p>
                            )}
                            {!jobsLoading && jobsError && (
                                <p className="text-sm text-red-600">{jobsError}</p>
                            )}
                            {!jobsLoading && !jobsError && (
                                <div className="space-y-1 text-sm text-neutral-600">
                                    <p>
                                        Showing {displayJobs.length} job
                                        {displayJobs.length === 1 ? "" : "s"}
                                        {loadedCount > displayJobs.length
                                            ? ` (capped at your limit of ${limitNum})`
                                            : ""}
                                        {selectedCategory
                                            ? ` in “${selectedCategory.label}”`
                                            : ""}
                                    </p>
                                    {loadedCount > 0 &&
                                        loadedCount < limitNum && (
                                            <p className="text-xs text-neutral-500">
                                                Remotive returned {loadedCount} listing
                                                {loadedCount === 1 ? "" : "s"} for this
                                                query; the public feed is often capped
                                                well below your requested limit.
                                            </p>
                                        )}
                                </div>
                            )}
                        </div>

                        {!jobsLoading &&
                            !jobsError &&
                            displayJobs.length > 0 && (
                            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                                {displayJobs.map((job, i) => {
                                    const logoSrc = getProxiedRemotiveLogoUrl(
                                        job,
                                        backendUrl,
                                    );
                                    return (
                                    <a
                                        key={job.id ?? `job-${i}`}
                                        href={job.url ?? "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 transition-all duration-200 hover:border-emerald-400 hover:bg-white"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex min-w-0 flex-1 gap-3">
                                                <RemotiveCompanyAvatar
                                                    logoSrc={logoSrc}
                                                    companyName={
                                                        job.company_name ?? "?"
                                                    }
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-base font-semibold text-neutral-900">
                                                        {job.title ?? "Untitled"}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-neutral-600">
                                                        {job.company_name ?? "Company"}
                                                        {job.category
                                                            ? ` · ${job.category}`
                                                            : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="shrink-0 text-right text-sm text-green-700">
                                                {job.salary != null &&
                                                String(job.salary).trim() !== ""
                                                    ? job.salary
                                                    : "Salary not listed"}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                                            {job.job_type && (
                                                <span className="rounded bg-neutral-100 px-2 py-0.5">
                                                    {job.job_type.replace(/_/g, " ")}
                                                </span>
                                            )}
                                            {job.candidate_required_location && (
                                                <span>{job.candidate_required_location}</span>
                                            )}
                                        </div>
                                        {job.description && (
                                            <p className="mt-2 text-sm text-neutral-600">
                                                {stripHtml(job.description).slice(0, 280)}
                                                {stripHtml(job.description).length > 280
                                                    ? "…"
                                                    : ""}
                                            </p>
                                        )}
                                        <div className="mt-3 text-xs text-neutral-500">
                                            {job.publication_date
                                                ? `Posted ${moment(job.publication_date).fromNow()}`
                                                : ""}
                                        </div>
                                    </a>
                                    );
                                })}
                            </div>
                        )}

                        {!jobsLoading && !jobsError && displayJobs.length === 0 && (
                            <div className="flex h-48 items-center justify-center rounded-lg border border-neutral-200 bg-white p-4">
                                <p className="text-sm text-neutral-600">
                                    No jobs match these filters. Try clearing category or
                                    broadening search.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
