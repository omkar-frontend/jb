import { api, isApiConfigured } from './api'

export const JOBS_PER_SOURCE = 5

export type JobSource =
    | 'adzuna'
    | 'serp'
    | 'remotive'
    | 'himalayas'
    | 'jsearch'

export type RelevantJob = {
    id: string
    title: string
    company: string
    location: string | null
    source: JobSource
    sourceLabel: string
    url: string
    summary: string | null
    logo: string | null
    meta: string | null
}

type ApiEnvelope<T> = {
    success?: boolean
    error?: string
    data?: T
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncate(text: string, max = 220): string {
    const t = text.trim()
    if (t.length <= max) return t
    return `${t.slice(0, max)}…`
}

function googleApplyUrl(job: {
    apply_options?: Array<{ link?: string }>
    source_link?: string
    share_link?: string
}): string {
    for (const opt of job.apply_options ?? []) {
        const link = opt.link?.trim()
        if (link) return link
    }
    return job.source_link?.trim() || job.share_link?.trim() || ''
}

function googleSalary(job: {
    detected_extensions?: Record<string, unknown>
    extensions?: string[]
}): string | null {
    const salary = job.detected_extensions?.salary
    if (salary != null && String(salary).trim()) {
        return String(salary).trim()
    }
    for (const tag of job.extensions ?? []) {
        const t = tag.trim()
        if (!t || !/\d/.test(t)) continue
        if (
            /\bK\b/i.test(t) ||
            /\$|£|€/.test(t) ||
            /\/hr|per\s+hour|per\s+year|a\s+year/i.test(t) ||
            (/–|—|-/.test(t) && /\d/.test(t))
        ) {
            return t
        }
    }
    return null
}

async function fetchAdzunaJobs(
    designation: string,
    location: string | null,
    signal?: AbortSignal
): Promise<RelevantJob[]> {
    const response = await api.get<
        ApiEnvelope<{
            results?: Array<{
                id?: string
                title?: string
                redirect_url?: string
                company?: { display_name?: string }
                location?: { display_name?: string }
                contract_time?: string
                description?: string
            }>
        }>
    >('/adzuna/jobs/gb/search/1', {
        signal,
        params: {
            what: designation,
            where: location?.trim() || undefined,
            results_per_page: JOBS_PER_SOURCE,
        },
    })

    if (!response.data.success) {
        throw new Error(response.data.error ?? 'Adzuna request failed')
    }

    return (response.data.data?.results ?? []).slice(0, JOBS_PER_SOURCE).map(
        (job, index) => ({
            id: `adzuna-${job.id ?? index}`,
            title: job.title?.trim() || 'Untitled role',
            company: job.company?.display_name?.trim() || 'Company',
            location: job.location?.display_name?.trim() || null,
            source: 'adzuna',
            sourceLabel: 'Adzuna',
            url: job.redirect_url?.trim() || '#',
            summary: job.description ? truncate(stripHtml(job.description)) : null,
            logo: null,
            meta: job.contract_time?.trim() || null,
        })
    )
}

async function fetchSerpJobs(
    designation: string,
    location: string | null,
    signal?: AbortSignal
): Promise<RelevantJob[]> {
    const response = await api.get<
        ApiEnvelope<{
            jobs_results?: Array<{
                job_id?: string
                title?: string
                company_name?: string
                location?: string
                via?: string
                thumbnail?: string
                description?: string
                apply_options?: Array<{ link?: string }>
                source_link?: string
                share_link?: string
                detected_extensions?: Record<string, unknown>
                extensions?: string[]
            }>
        }>
    >('/serp/jobs', {
        signal,
        params: {
            q: designation,
            location: location?.trim() || 'United States',
        },
    })

    if (!response.data.success) {
        throw new Error(response.data.error ?? 'Google Jobs request failed')
    }

    return (response.data.data?.jobs_results ?? [])
        .slice(0, JOBS_PER_SOURCE)
        .map((job, index) => {
            const salary = googleSalary(job)
            const metaParts = [job.via?.trim(), salary].filter(Boolean)
            return {
                id: `serp-${job.job_id ?? index}`,
                title: job.title?.trim() || 'Untitled role',
                company: job.company_name?.trim() || 'Company',
                location: job.location?.trim() || null,
                source: 'serp',
                sourceLabel: 'Google',
                url: googleApplyUrl(job) || '#',
                summary: job.description ? truncate(job.description) : null,
                logo: job.thumbnail?.trim() || null,
                meta: metaParts.length > 0 ? metaParts.join(' · ') : null,
            }
        })
}

async function fetchRemotiveJobs(
    designation: string,
    signal?: AbortSignal
): Promise<RelevantJob[]> {
    const response = await api.get<
        ApiEnvelope<{
            jobs?: Array<{
                id?: number
                url?: string
                title?: string
                company_name?: string
                company_logo?: string
                company_logo_url?: string
                job_type?: string
                candidate_required_location?: string
                salary?: string
                description?: string
            }>
        }>
    >('/remotive/remote-jobs', {
        signal,
        params: {
            search: designation,
            limit: String(JOBS_PER_SOURCE * 4),
        },
    })

    if (!response.data.success) {
        throw new Error(response.data.error ?? 'Remotive request failed')
    }

    return (response.data.data?.jobs ?? []).slice(0, JOBS_PER_SOURCE).map(
        (job, index) => ({
            id: `remotive-${job.id ?? index}`,
            title: job.title?.trim() || 'Untitled role',
            company: job.company_name?.trim() || 'Company',
            location: job.candidate_required_location?.trim() || 'Remote',
            source: 'remotive',
            sourceLabel: 'Remotive',
            url: job.url?.trim() || '#',
            summary: job.description ? truncate(stripHtml(job.description)) : null,
            logo:
                job.company_logo?.trim() ||
                job.company_logo_url?.trim() ||
                null,
            meta: [job.job_type?.trim(), job.salary?.trim()]
                .filter(Boolean)
                .join(' · ') || null,
        })
    )
}

async function fetchHimalayasJobs(
    designation: string,
    signal?: AbortSignal
): Promise<RelevantJob[]> {
    const response = await api.get<
        ApiEnvelope<{
            jobs?: Array<{
                title?: string
                excerpt?: string
                description?: string
                companyName?: string
                companyLogo?: string
                employmentType?: string
                locationRestrictions?: string[]
                applicationLink?: string
                guid?: string
            }>
        }>
    >('/himalayas/jobs/search', {
        signal,
        params: {
            q: designation,
            page: 1,
            sort: 'recent',
        },
    })

    if (!response.data.success) {
        throw new Error(response.data.error ?? 'Himalayas request failed')
    }

    return (response.data.data?.jobs ?? []).slice(0, JOBS_PER_SOURCE).map(
        (job, index) => {
            const summary =
                job.excerpt?.trim() ||
                (job.description ? stripHtml(job.description) : '')
            const loc = job.locationRestrictions?.join(', ') || 'Remote'
            return {
                id: `himalayas-${job.guid ?? index}`,
                title: job.title?.trim() || 'Untitled role',
                company: job.companyName?.trim() || 'Company',
                location: loc,
                source: 'himalayas',
                sourceLabel: 'Himalayas',
                url: job.applicationLink?.trim() || job.guid?.trim() || '#',
                summary: summary ? truncate(summary) : null,
                logo: job.companyLogo?.trim() || null,
                meta: job.employmentType?.trim() || null,
            }
        }
    )
}

async function fetchJSearchJobs(
    designation: string,
    signal?: AbortSignal
): Promise<RelevantJob[]> {
    const response = await api.get<
        ApiEnvelope<{
            data?: Array<{
                job_id?: string
                job_title?: string
                employer_name?: string
                employer_logo?: string
                job_publisher?: string
                job_employment_type?: string
                job_apply_link?: string
                job_google_link?: string
                job_description?: string
                job_city?: string
                job_state?: string
                job_country?: string
                job_location?: string
                job_is_remote?: boolean | null
            }>
        }>
    >('/jsearch/search', {
        signal,
        params: {
            query: `${designation} jobs`,
            page: 1,
            num_pages: 1,
        },
    })

    if (!response.data.success) {
        throw new Error(response.data.error ?? 'JSearch request failed')
    }

    return (response.data.data?.data ?? []).slice(0, JOBS_PER_SOURCE).map(
        (job, index) => {
            const locParts = [job.job_city, job.job_state, job.job_country].filter(
                Boolean
            )
            const location =
                job.job_location?.trim() ||
                (locParts.length > 0 ? locParts.join(', ') : null)
            const metaParts = [
                job.job_publisher?.trim(),
                job.job_employment_type?.trim(),
                job.job_is_remote === true ? 'Remote' : null,
            ].filter(Boolean)

            return {
                id: `jsearch-${job.job_id ?? index}`,
                title: job.job_title?.trim() || 'Untitled role',
                company: job.employer_name?.trim() || 'Company',
                location,
                source: 'jsearch',
                sourceLabel: 'JSearch',
                url:
                    job.job_apply_link?.trim() ||
                    job.job_google_link?.trim() ||
                    '#',
                summary: job.job_description
                    ? truncate(stripHtml(job.job_description))
                    : null,
                logo: job.employer_logo?.trim() || null,
                meta: metaParts.length > 0 ? metaParts.join(' · ') : null,
            }
        }
    )
}

export function isRelevantJobsConfigured(): boolean {
    return isApiConfigured()
}

export async function fetchRelevantJobs(
    designation: string,
    location: string | null,
    signal?: AbortSignal
): Promise<{
    jobs: RelevantJob[]
    sourceErrors: Partial<Record<JobSource, string>>
}> {
    if (!isApiConfigured()) {
        return { jobs: [], sourceErrors: {} }
    }

    const query = designation.trim()
    if (!query) {
        return { jobs: [], sourceErrors: {} }
    }

    const fetchers: Array<{
        source: JobSource
        run: () => Promise<RelevantJob[]>
    }> = [
        { source: 'adzuna', run: () => fetchAdzunaJobs(query, location, signal) },
        { source: 'serp', run: () => fetchSerpJobs(query, location, signal) },
        { source: 'remotive', run: () => fetchRemotiveJobs(query, signal) },
        { source: 'himalayas', run: () => fetchHimalayasJobs(query, signal) },
        { source: 'jsearch', run: () => fetchJSearchJobs(query, signal) },
    ]

    const results = await Promise.allSettled(
        fetchers.map((entry) => entry.run())
    )

    const jobs: RelevantJob[] = []
    const sourceErrors: Partial<Record<JobSource, string>> = {}

    results.forEach((result, index) => {
        const source = fetchers[index]?.source
        if (!source) return
        if (result.status === 'fulfilled') {
            jobs.push(...result.value)
        } else {
            const message =
                result.reason instanceof Error
                    ? result.reason.message
                    : 'Could not load jobs'
            sourceErrors[source] = message
        }
    })

    return { jobs, sourceErrors }
}
