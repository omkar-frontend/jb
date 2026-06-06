import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Briefcase, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
    getCvProfile,
    parseExtractedInformation,
    readPendingCvExtract,
    type CvExtracted,
} from '../lib/cvProfile'
import {
    fetchRelevantJobs,
    isRelevantJobsConfigured,
    type RelevantJob,
} from '../lib/relevantJobs'

type RelevantJobsProps = {
    extractedOverride?: CvExtracted | null
}

function JobCard({ job }: { job: RelevantJob }) {
    const cardClassName =
        'block rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 text-left transition-all duration-200 hover:border-emerald-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2'

    const inner = (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {job.logo ? (
                <img
                    src={job.logo}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 object-contain"
                />
            ) : (
                <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-200 text-sm font-semibold text-neutral-700"
                    aria-hidden
                >
                    {(job.company.trim()[0] ?? '?').toUpperCase()}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-neutral-900">{job.title}</p>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {job.sourceLabel}
                    </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.meta ? ` · ${job.meta}` : ''}
                </p>
                {job.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-700">
                        {job.summary}
                    </p>
                ) : null}
            </div>
        </div>
    )

    if (job.url && job.url !== '#') {
        return (
            <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className={cardClassName}
            >
                {inner}
            </a>
        )
    }

    return <div className={cardClassName}>{inner}</div>
}

export default function RelevantJobs({ extractedOverride }: RelevantJobsProps) {
    const { user, loading: authLoading } = useAuth()
    const [designation, setDesignation] = useState<string | null>(null)
    const [location, setLocation] = useState<string | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [jobs, setJobs] = useState<RelevantJob[]>([])
    const [jobsLoading, setJobsLoading] = useState(false)
    const [jobsError, setJobsError] = useState<string | null>(null)
    const [failedSources, setFailedSources] = useState<string[]>([])

    useEffect(() => {
        if (extractedOverride?.designation?.trim()) {
            setDesignation(extractedOverride.designation.trim())
            setLocation(extractedOverride.location?.trim() || null)
        }
    }, [extractedOverride])

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            setDesignation(null)
            setLocation(null)
            setProfileLoading(false)
            return
        }

        if (extractedOverride?.designation?.trim()) {
            setProfileLoading(false)
            return
        }

        let cancelled = false

        void (async () => {
            setProfileLoading(true)

            const pending = readPendingCvExtract()
            if (pending?.data?.extracted?.designation?.trim()) {
                if (!cancelled) {
                    setDesignation(pending.data.extracted.designation.trim())
                    setLocation(pending.data.extracted.location?.trim() || null)
                    setProfileLoading(false)
                }
                return
            }

            const { data, error } = await getCvProfile()
            if (cancelled) return

            if (error || !data?.extractedInformation) {
                setDesignation(null)
                setLocation(null)
                setProfileLoading(false)
                return
            }

            const parsed = parseExtractedInformation(data.extractedInformation)
            const extracted = parsed?.data?.extracted
            setDesignation(extracted?.designation?.trim() || null)
            setLocation(extracted?.location?.trim() || null)
            setProfileLoading(false)
        })()

        return () => {
            cancelled = true
        }
    }, [authLoading, user, extractedOverride])

    useEffect(() => {
        if (!designation || !isRelevantJobsConfigured()) {
            setJobs([])
            setFailedSources([])
            setJobsError(null)
            return
        }

        const ctrl = new AbortController()

        void (async () => {
            setJobsLoading(true)
            setJobsError(null)
            setFailedSources([])

            try {
                const { jobs: fetched, sourceErrors } = await fetchRelevantJobs(
                    designation,
                    location,
                    ctrl.signal
                )

                if (ctrl.signal.aborted) return

                setJobs(fetched)
                setFailedSources(
                    Object.values(sourceErrors).filter(
                        (message): message is string => Boolean(message)
                    )
                )

                if (fetched.length === 0 && Object.keys(sourceErrors).length > 0) {
                    setJobsError('Could not load jobs from any provider.')
                }
            } catch (err) {
                if (ctrl.signal.aborted) return
                setJobsError(
                    err instanceof Error
                        ? err.message
                        : 'Could not load relevant jobs'
                )
                setJobs([])
            } finally {
                if (!ctrl.signal.aborted) setJobsLoading(false)
            }
        })()

        return () => ctrl.abort()
    }, [designation, location])

    if (authLoading || profileLoading) {
        return null
    }

    if (!user || !designation) {
        return null
    }

    return (
        <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <Briefcase
                            className="h-5 w-5 text-emerald-600"
                            aria-hidden
                        />
                        <h2 className="text-lg font-semibold text-neutral-900">
                            Relevant jobs
                        </h2>
                    </div>
                    <p className="text-sm text-neutral-600">
                        Listings matched to your designation{' '}
                        <span className="font-medium text-neutral-800">
                            {designation}
                        </span>
                        {location ? (
                            <>
                                {' '}
                                in{' '}
                                <span className="font-medium text-neutral-800">
                                    {location}
                                </span>
                            </>
                        ) : null}
                    </p>
                </div>
                <Link
                    to="/details"
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                    Edit profile
                </Link>
            </div>

            {jobsLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-12 text-neutral-600">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Searching job boards…
                </div>
            ) : jobsError ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{jobsError}</span>
                </div>
            ) : jobs.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-600">
                    No matching jobs found right now. Try updating your designation
                    on the details page.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </div>
            )}

            {!jobsLoading && failedSources.length > 0 && jobs.length > 0 ? (
                <p className="mt-3 text-xs text-neutral-500">
                    Some providers could not be reached; showing results from
                    others.
                </p>
            ) : null}
        </section>
    )
}
