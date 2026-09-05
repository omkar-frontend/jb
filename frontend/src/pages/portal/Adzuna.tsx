import { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../../lib/api";
import moment from "moment";
import Select from "react-select";
import SubHeader from "../../components/SubHeader";
import PortalJobCard from "../../components/PortalJobCard";
import { Checkbox } from "@/components/ui/checkbox";
import { selectStyles } from "../../lib/multiSelectStyles";

const ADZUNA_FIRST_PAGE = 1;
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

type CountryOption = {
    value: string;
    label: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
    { value: "au", label: "Australia" },
    { value: "at", label: "Austria" },
    { value: "be", label: "Belgium" },
    { value: "br", label: "Brazil" },
    { value: "ca", label: "Canada" },
    { value: "fr", label: "France" },
    { value: "de", label: "Germany" },
    { value: "in", label: "India" },
    { value: "it", label: "Italy" },
    { value: "mx", label: "Mexico" },
    { value: "nl", label: "Netherlands" },
    { value: "nz", label: "New Zealand" },
    { value: "pl", label: "Poland" },
    { value: "sg", label: "Singapore" },
    { value: "za", label: "South Africa" },
    { value: "es", label: "Spain" },
    { value: "ch", label: "Switzerland" },
    { value: "gb", label: "United Kingdom" },
    { value: "us", label: "United States" },
];

const DEFAULT_COUNTRY_CODE = "gb";

const getDefaultCountryOption = (): CountryOption => {
    const browserTimezone =
        typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() ?? ""
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
    const regionFromBrowser = browserLocale.split(/[-_]/)[1]?.toLowerCase() ?? "";
    const countryCode =
        regionFromTimezone ||
        regionFromMoment ||
        regionFromBrowser ||
        DEFAULT_COUNTRY_CODE;

    return (
        COUNTRY_OPTIONS.find((country) => country.value === countryCode) ??
        COUNTRY_OPTIONS.find((country) => country.value === DEFAULT_COUNTRY_CODE) ??
        COUNTRY_OPTIONS[0]
    );
};

type AdzunaCategory = {
    tag: string;
    label: string;
};

type CategoryOption = {
    value: string;
    label: string;
};

type CategoriesResponseBody = {
    success?: boolean;
    data?: {
        results?: AdzunaCategory[];
    };
};

/** Adzuna search payload shape varies; we only read optional fields safely for display */
type JobsSearchResponseBody = {
    success?: boolean;
    error?: string;
    data?: {
        results?: Array<{
            id?: string;
            title?: string;
            redirect_url?: string;
            company?: { display_name?: string };
            location?: { display_name?: string };
            salary_min?: number;
            salary_max?: number;
            contract_time?: string;
            created?: string;
            description?: string;
        }>;
        count?: number;
    };
};

export default function Adzuna() {
    const [categories, setCategories] = useState<AdzunaCategory[]>([]);
    const [selectedCountry, setSelectedCountry] =
        useState<CountryOption>(getDefaultCountryOption);
    const [selectedCategory, setSelectedCategory] =
        useState<AdzunaCategory | null>(null);
    const [jobsPayload, setJobsPayload] =
        useState<JobsSearchResponseBody["data"] | null>(null);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [jobsError, setJobsError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(ADZUNA_FIRST_PAGE);
    const [jobKeyword, setJobKeyword] = useState("");
    const [jobLocation, setJobLocation] = useState("");
    const [salaryMin, setSalaryMin] = useState("");
    const [salaryMax, setSalaryMax] = useState("");
    const [maxDaysOld, setMaxDaysOld] = useState("");
    const [fullTimeOnly, setFullTimeOnly] = useState(false);
    const [partTimeOnly, setPartTimeOnly] = useState(false);
    const debouncedJobKeyword = useDebouncedValue(jobKeyword, FILTER_DEBOUNCE_MS);
    const debouncedJobLocation = useDebouncedValue(jobLocation, FILTER_DEBOUNCE_MS);
    const debouncedSalaryMin = useDebouncedValue(salaryMin, FILTER_DEBOUNCE_MS);
    const debouncedSalaryMax = useDebouncedValue(salaryMax, FILTER_DEBOUNCE_MS);
    const debouncedMaxDaysOld = useDebouncedValue(maxDaysOld, FILTER_DEBOUNCE_MS);


    const fetchCategories = async () => {
        try {
            const response = await api.get<CategoriesResponseBody>(
                `/adzuna/categories`,
            );
            const results = response.data?.data?.results ?? [];
            setCategories(results);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        void fetchCategories();
    }, []);

    useEffect(() => {
        setCurrentPage(ADZUNA_FIRST_PAGE);
    }, [
        selectedCountry,
        selectedCategory,
        debouncedJobKeyword,
        debouncedJobLocation,
        debouncedSalaryMin,
        debouncedSalaryMax,
        debouncedMaxDaysOld,
        fullTimeOnly,
        partTimeOnly,
    ]);

    useEffect(() => {
        if (!selectedCategory) {
            setJobsPayload(null);
            setJobsError(null);
            return;
        }

        const ctrl = new AbortController();

        (async () => {
            setJobsLoading(true);
            setJobsError(null);
            try {
                const response = await api.get<JobsSearchResponseBody>(
                    `/adzuna/jobs/${selectedCountry.value}/search/${currentPage}`,
                    {
                        signal: ctrl.signal,
                        params: {
                            category: selectedCategory.tag,
                            what: debouncedJobKeyword.trim() || undefined,
                            where: debouncedJobLocation.trim() || undefined,
                            salary_min: debouncedSalaryMin.trim() || undefined,
                            salary_max: debouncedSalaryMax.trim() || undefined,
                            max_days_old: debouncedMaxDaysOld.trim() || undefined,
                            full_time: fullTimeOnly ? "1" : undefined,
                            part_time: partTimeOnly ? "1" : undefined,
                        },
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
        currentPage,
        selectedCategory,
        selectedCountry,
        debouncedJobKeyword,
        debouncedJobLocation,
        debouncedSalaryMin,
        debouncedSalaryMax,
        debouncedMaxDaysOld,
        fullTimeOnly,
        partTimeOnly,
    ]);

    const loadedResultsCount = jobsPayload?.results?.length ?? 0;
    const totalResultsCount = jobsPayload?.count ?? 0;
    const estimatedTotalPages =
        loadedResultsCount > 0 && totalResultsCount > 0
            ? Math.ceil(totalResultsCount / loadedResultsCount)
            : null;
    const canGoPrev = currentPage > ADZUNA_FIRST_PAGE;
    const canGoNext = jobsLoading
        ? false
        : estimatedTotalPages != null
          ? currentPage < estimatedTotalPages
          : loadedResultsCount > 0;

    return (
        <div className="min-h-[calc(100dvh)] bg-neutral-50 p-5 text-neutral-900 sm:px-40 sm:py-10">
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                    <SubHeader title="Adzuna" />
                    <div className="flex flex-wrap gap-2">
                        <div className="sm:min-w-72 min-w-0">
                            <Select<CategoryOption>
                                options={categories.map((cat) => ({
                                    value: cat.tag,
                                    label: cat.label,
                                }))}
                                value={
                                    selectedCategory
                                        ? {
                                              value: selectedCategory.tag,
                                              label: selectedCategory.label,
                                          }
                                        : null
                                }
                                onChange={(option) => {
                                    if (!option) {
                                        setSelectedCategory(null);
                                        return;
                                    }
                                    setSelectedCategory({
                                        tag: option.value,
                                        label: option.label,
                                    });
                                }}
                                isClearable
                                isSearchable
                                placeholder="Select category"
                                styles={selectStyles}
                            />
                        </div>
                    </div>
                </div>

                {selectedCategory ? (
                    <div className="grid lg:grid-cols-5 grid-cols-1 gap-3">
                        {/* Filters */}
                        <div className="h-fit rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] lg:sticky lg:top-20">
                            <div className="grid lg:grid-cols-1 grid-cols-2 gap-3">
                                <Select<CountryOption>
                                    options={COUNTRY_OPTIONS}
                                    value={selectedCountry}
                                    onChange={(option) => {
                                        if (option) setSelectedCountry(option);
                                    }}
                                    isSearchable
                                    placeholder="Select country"
                                    styles={selectStyles}
                                />
                                <input
                                    type="text"
                                    value={jobKeyword}
                                    onChange={(e) => setJobKeyword(e.target.value)}
                                    placeholder="Search job title (e.g. developer)"
                                    className="cmn-field"
                                />
                                <input
                                    type="text"
                                    value={jobLocation}
                                    onChange={(e) => setJobLocation(e.target.value)}
                                    placeholder="Location (where)"
                                    className="cmn-field"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    value={salaryMin}
                                    onChange={(e) => setSalaryMin(e.target.value)}
                                    placeholder="Min salary"
                                    className="cmn-field"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    value={salaryMax}
                                    onChange={(e) => setSalaryMax(e.target.value)}
                                    placeholder="Max salary"
                                    className="cmn-field"
                                />
                            </div>
                            <div className="mt-3 grid lg:grid-cols-1 md:grid-cols-4 sm:grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    value={maxDaysOld}
                                    onChange={(e) => setMaxDaysOld(e.target.value)}
                                    placeholder="Max days old"
                                    className="cmn-field"
                                />
                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                    <Checkbox
                                        checked={fullTimeOnly}
                                        onCheckedChange={(checked) => setFullTimeOnly(checked === true)}
                                        className="border-neutral-300 data-checked:border-emerald-600 data-checked:bg-emerald-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                    />
                                    Full-time only
                                </label>
                                <label className="flex items-center gap-2 text-sm text-neutral-700">
                                    <Checkbox
                                        checked={partTimeOnly}
                                        onCheckedChange={(checked) => setPartTimeOnly(checked === true)}
                                        className="border-neutral-300 data-checked:border-emerald-600 data-checked:bg-emerald-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                                    />
                                    Part-time only
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setJobKeyword("");
                                        setJobLocation("");
                                        setSalaryMin("");
                                        setSalaryMax("");
                                        setMaxDaysOld("");
                                        setFullTimeOnly(false);
                                        setPartTimeOnly(false);
                                    }}
                                    className=" rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                                >
                                    Clear filters
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-4 col-span-1 flex flex-col gap-3">
                            {/* Job Count and Pagination */}
                            <div className="sticky top-20 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                <p className="text-sm text-neutral-600">
                                    Jobs for{" "}
                                    <span className="text-neutral-900">
                                        {selectedCategory.label}
                                    </span>{" "}
                                    ({selectedCountry.label}, page {currentPage})
                                </p>
                                {jobsLoading && (
                                    <p className="text-sm text-neutral-500">
                                        Loading…
                                    </p>
                                )}
                                {!jobsLoading && jobsError && (
                                    <p className="text-sm text-red-600">
                                        {jobsError}
                                    </p>
                                )}
                                {!jobsLoading && !jobsError && jobsPayload && (
                                    <p className="text-sm text-neutral-600">
                                        {jobsPayload.count != null
                                            ? `${jobsPayload.count} results`
                                            : `${jobsPayload.results?.length ?? 0} loaded`}
                                    </p>
                                )}
                                {!jobsLoading && !jobsError && jobsPayload && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => prev - 1)}
                                            disabled={!canGoPrev}
                                            className=" rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-sm text-neutral-600">
                                            Page {currentPage}
                                            {estimatedTotalPages != null
                                                ? ` of ${estimatedTotalPages}`
                                                : ""}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((prev) => prev + 1)}
                                            disabled={!canGoNext}
                                            className=" rounded-lg border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Jobs List */}
                            {!jobsLoading && !jobsError && jobsPayload?.results && (
                                <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e6e6]/75 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                                    {jobsPayload.results.map((job, i) => (
                                        <PortalJobCard
                                            key={job.id ?? `${job.title ?? "job"}-${i}`}
                                            href={job.redirect_url}
                                            title={job.title}
                                            company={job.company?.display_name}
                                            location={job.location?.display_name}
                                            salary={
                                                job.salary_min != null &&
                                                job.salary_max != null
                                                    ? `${Math.round(job.salary_min).toLocaleString()} - ${Math.round(job.salary_max).toLocaleString()}`
                                                    : null
                                            }
                                            description={job.description}
                                            jobType={job.contract_time}
                                            postedAt={
                                                job.created
                                                    ? moment(job.created).fromNow()
                                                    : null
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-96 w-full flex items-center justify-center">
                        <p className="text-sm text-neutral-600">Select category to see jobs</p>
                    </div>
                )
            }
            </div>
        </div>
    );
}