import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../../lib/api";
import moment from "moment";
import CreatableSelect from "react-select/creatable";
import SubHeader from "../../components/SubHeader";
import PortalJobCard from "../../components/PortalJobCard";
import { selectStyles } from "../../lib/multiSelectStyles";
import InlineLoading from "../../components/InlineLoading";

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
                const res = await api.get<{ success?: boolean; data?: unknown }>(
                    `/remotive/remote-jobs/categories`,
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
    }, []);

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

                const response = await api.get<JobsResponse>(
                    `/remotive/remote-jobs`,
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
                    <div className="h-fit rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] lg:sticky lg:top-20">
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
                                    styles={selectStyles}
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
                                    className="cmn-field"
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
                                    className="cmn-field"
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
                                    className="cmn-field"
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
                                className=" rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:col-span-4">
                        <div className="sticky top-20 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                            {jobsLoading && <InlineLoading />}
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
                            <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                {displayJobs.map((job, i) => (
                                    <PortalJobCard
                                        key={job.id ?? `job-${i}`}
                                        href={job.url}
                                        title={job.title}
                                        company={job.company_name}
                                        location={
                                            job.candidate_required_location
                                        }
                                        salary={
                                            job.salary != null &&
                                            String(job.salary).trim() !== ""
                                                ? job.salary
                                                : null
                                        }
                                        description={job.description}
                                        jobType={job.job_type}
                                        postedAt={
                                            job.publication_date
                                                ? moment(
                                                      job.publication_date,
                                                  ).fromNow()
                                                : null
                                        }
                                        logoUrl={getProxiedRemotiveLogoUrl(
                                            job,
                                            backendUrl,
                                        )}
                                        meta={
                                            job.category
                                                ? [job.category]
                                                : []
                                        }
                                        tags={job.tags ?? []}
                                    />
                                ))}
                            </div>
                        )}

                        {!jobsLoading && !jobsError && displayJobs.length === 0 && (
                            <div className="flex h-48 items-center justify-center rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
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
