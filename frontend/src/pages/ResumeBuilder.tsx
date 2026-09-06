import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { AlertCircle, ExternalLink, Info, Loader, Printer, RefreshCcw } from 'lucide-react'
import { Back } from '../components/Back'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../components/ui/tooltip'
import SectionPalette from '../components/resume/SectionPalette'
import SectionProperties from '../components/resume/SectionProperties'
import SortableSection, {
    type RebuildBullet,
} from '../components/resume/SortableSection'
import { sectionFromBlueprint, type BlockBlueprint } from '../components/resume/blocks'
import { useAuth } from '../context/AuthContext'
import {
    getCvProfile,
    parseExtractedInformation,
    type CvExtracted,
} from '../lib/cvProfile'
import {
    clearCachedResume,
    readCachedResume,
    rebuildBullet as rebuildBulletRequest,
    tailorCacheKey,
    tailorResume,
    writeCachedResume,
    type Resume,
    type ResumeSource,
    type SectionStyle,
} from '../lib/resume'

/** Everything the job card knew, carried through the router so the builder can
 *  show the full posting without asking the provider for it again. */
export type ResumeJobDetails = {
    location: string | null
    salary: string | null
    jobType: string | null
    postedAt: string | null
    via: string | null
    logoUrl: string | null
    tags: string[]
    meta: string[]
    href: string | null
    applyLinks: { title: string; link: string }[]
}

export type ResumeBuilderState = {
    jobTitle: string | null
    company: string | null
    jobDescription: string
    job?: ResumeJobDetails
}

const DEFAULT_ACCENT = '#059669'
const CANVAS_DROPPABLE_ID = 'resume-canvas'

/**
 * The sheet, as a drop target. Split out because useDroppable must run inside
 * the DndContext provider — calling it in the component that *renders*
 * DndContext registers nothing, and dropping onto empty canvas silently fails.
 */
function CanvasSheet({
    onDeselect,
    children,
}: {
    onDeselect: () => void
    children: React.ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID })

    return (
        <article
            ref={setNodeRef}
            // Only a click on the sheet itself deselects. Without the target
            // check, a click on a section bubbles up here and clears the
            // selection the section just made.
            onClick={(e) => {
                if (e.target === e.currentTarget) onDeselect()
            }}
            className={`mx-auto w-full max-w-[210mm] rounded-xl border bg-white p-3 shadow-sm transition-colors print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none ${
                isOver ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-neutral-200'
            }`}
        >
            {children}
        </article>
    )
}

/**
 * The whole posting, one click from the builder. Tailoring happens against text
 * the user can no longer see once they leave the listing, and checking a claim
 * against the job ad is exactly what someone does while editing a resume.
 */
function JobDetailsDialog({ job }: { job: ResumeBuilderState }) {
    const details = job.job
    const facts = [
        ['Company', job.company],
        ['Location', details?.location],
        ['Salary', details?.salary],
        ['Type', details?.jobType?.replace(/_/g, ' ')],
        ['Posted', details?.postedAt],
        ['Source', details?.via],
    ].filter(([, value]) => Boolean(value)) as [string, string][]

    if (!job.jobDescription.trim() && facts.length === 0) return null

    return (
        <Dialog>
            <DialogTrigger className="inline-flex shrink-0 items-center gap-1 rounded text-[12px] font-medium text-emerald-700 underline-offset-2 hover:underline">
                <Info className="h-3.5 w-3.5" aria-hidden />
                View job
            </DialogTrigger>
            <DialogContent className="max-w-2xl text-left">
                <DialogHeader className="mb-4 text-left">
                    <DialogTitle>{job.jobTitle ?? 'This role'}</DialogTitle>
                    <DialogDescription>
                        {job.company ?? 'Company not listed'}
                    </DialogDescription>
                </DialogHeader>

                {facts.length > 0 ? (
                    <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
                        {facts.map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-neutral-500">{label}</dt>
                                <dd className="text-neutral-900">{value}</dd>
                            </div>
                        ))}
                    </dl>
                ) : null}

                {details?.tags?.length ? (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {details.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-700"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}

                {job.jobDescription.trim() ? (
                    <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
                            {job.jobDescription}
                        </p>
                    </div>
                ) : null}

                {details?.applyLinks?.length || details?.href ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {(details.applyLinks ?? []).map((link, i) => (
                            <a
                                key={`${link.link}-${i}`}
                                href={link.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-800 hover:bg-neutral-50"
                            >
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                {link.title}
                            </a>
                        ))}
                        {details.href ? (
                            <a
                                href={details.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-800 hover:bg-neutral-50"
                            >
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                Original listing
                            </a>
                        ) : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

export default function ResumeBuilder() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, loading: authLoading } = useAuth()
    // Keyed on the id, not the user object: a token refresh hands back a new
    // object, and depending on it would fire another billed Gemini call.
    const userId = user?.id ?? null
    const jobContext = (location.state as ResumeBuilderState | null) ?? null
    const cacheKey = jobContext?.jobDescription
        ? tailorCacheKey({
              jobTitle: jobContext.jobTitle,
              company: jobContext.company,
              jobDescription: jobContext.jobDescription,
          })
        : null

    // Seeded from the cache at init rather than inside the effect: a cache hit
    // should render the draft on the first paint, with no request and no
    // loading flash.
    const cachedDraft = cacheKey ? readCachedResume(cacheKey) : null

    const [resume, setResume] = useState<Resume | null>(cachedDraft?.resume ?? null)
    const [loading, setLoading] = useState(!cachedDraft)
    const [error, setError] = useState<string | null>(null)
    const [accent, setAccent] = useState(DEFAULT_ACCENT)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    /** Entries select independently of their section, so a single role can be
     *  picked out of an Experience block to reorder or delete. */
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
    const [source, setSource] = useState<ResumeSource>(cachedDraft?.source ?? 'cv')
    const [regenerateKey, setRegenerateKey] = useState(0)
    /** The saved CV, so sections can pull in real entries instead of retyping. */
    const [cv, setCv] = useState<CvExtracted | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        if (authLoading || !userId || !jobContext?.jobDescription || !cacheKey) return

        // Already built (or edited) this job in this session: the state above is
        // already seeded from it, so there is nothing to request.
        if (readCachedResume(cacheKey)) return

        const ctrl = new AbortController()

        void (async () => {
            setLoading(true)
            setError(null)
            const {
                resume: built,
                source: builtSource,
                error: buildError,
            } = await tailorResume(
                {
                    jobTitle: jobContext.jobTitle,
                    company: jobContext.company,
                    jobDescription: jobContext.jobDescription,
                },
                ctrl.signal
            )
            if (ctrl.signal.aborted) return
            if (buildError) {
                setError(buildError)
            } else {
                setResume(built)
                setSource(builtSource)
                if (built) writeCachedResume(cacheKey, built, builtSource)
            }
            setLoading(false)
        })()

        return () => ctrl.abort()
    }, [authLoading, userId, jobContext, cacheKey, regenerateKey])

    // Keep the draft in step with the cache so leaving and coming back restores
    // the sheet as the user left it, edits and styling included.
    useEffect(() => {
        if (!cacheKey || !resume) return
        writeCachedResume(cacheKey, resume, source)
    }, [cacheKey, resume, source])

    // Loaded alongside the tailored resume; a failure here only costs the
    // "From your CV" shortcut, so it does not surface an error.
    useEffect(() => {
        if (authLoading || !userId) return

        let cancelled = false

        void (async () => {
            const { data } = await getCvProfile()
            if (cancelled || !data?.extractedInformation) return
            const parsed = parseExtractedInformation(data.extractedInformation)
            if (parsed?.data?.extracted) setCv(parsed.data.extracted)
        })()

        return () => {
            cancelled = true
        }
    }, [authLoading, userId])

    const addSection = useCallback(
        (blueprint: BlockBlueprint, beforeSectionId?: string) => {
            const created = sectionFromBlueprint(blueprint)
            setResume((prev) => {
                if (!prev) return prev
                const sections = [...prev.sections]
                const at = beforeSectionId
                    ? sections.findIndex((s) => s.id === beforeSectionId)
                    : -1
                if (at === -1) sections.push(created)
                else sections.splice(at, 0, created)
                return { ...prev, sections }
            })
            setSelectedId(created.id)
        },
        []
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event
            if (!over) return

            // Entries cover nearly all of a section's area, so whatever is
            // dropped onto one usually reports an entry as the target. Anything
            // working at section level has to climb back up to its owner first.
            const overSectionId =
                over.data.current?.type === 'entry'
                    ? String(over.data.current.sectionId)
                    : String(over.id)

            // A palette block: insert a new section rather than reorder one.
            const blueprint = active.data.current?.blueprint as
                | BlockBlueprint
                | undefined
            if (active.data.current?.from === 'palette' && blueprint) {
                addSection(
                    blueprint,
                    over.id === CANVAS_DROPPABLE_ID ? undefined : overSectionId
                )
                return
            }

            if (active.id === over.id) return

            // An entry reorders inside its own section. Dropping one onto a
            // different section is ignored rather than guessed at — moving a job
            // into Education is far more likely a slip than an intention.
            if (active.data.current?.type === 'entry') {
                const sectionId = String(active.data.current.sectionId)
                setResume((prev) => {
                    if (!prev) return prev
                    const index = prev.sections.findIndex((s) => s.id === sectionId)
                    const section = prev.sections[index]
                    if (index === -1 || !section) return prev
                    const from = section.entries.findIndex((e) => e.id === active.id)
                    const to = section.entries.findIndex((e) => e.id === over.id)
                    if (from === -1 || to === -1 || from === to) return prev
                    const sections = [...prev.sections]
                    sections[index] = {
                        ...section,
                        entries: arrayMove(section.entries, from, to),
                    }
                    return { ...prev, sections }
                })
                return
            }

            setResume((prev) => {
                if (!prev) return prev
                const from = prev.sections.findIndex((s) => s.id === active.id)
                const to = prev.sections.findIndex((s) => s.id === overSectionId)
                if (from === -1 || to === -1 || from === to) return prev
                return { ...prev, sections: arrayMove(prev.sections, from, to) }
            })
        },
        [addSection]
    )

    /** null when there is no job to tailor against, which hides the affordance. */
    const rebuildBullet: RebuildBullet | null = useCallback(
        async (bullet: string, context: { entryTitle: string; entrySubtitle: string | null }) =>
            rebuildBulletRequest({
                bullet,
                jobTitle: jobContext?.jobTitle ?? null,
                company: jobContext?.company ?? null,
                jobDescription: jobContext?.jobDescription ?? '',
                entryTitle: context.entryTitle,
                entrySubtitle: context.entrySubtitle,
            }),
        [jobContext]
    )

    const updateStyle = useCallback(
        (next: SectionStyle) => {
            setResume((prev) => {
                if (!prev || !selectedId) return prev
                return {
                    ...prev,
                    sections: prev.sections.map((s) =>
                        s.id === selectedId ? { ...s, style: next } : s
                    ),
                }
            })
        },
        [selectedId]
    )

    const applyStyleToAll = useCallback((style: SectionStyle) => {
        setResume((prev) =>
            prev
                ? { ...prev, sections: prev.sections.map((s) => ({ ...s, style })) }
                : prev
        )
    }, [])

    if (!authLoading && !user) {
        return <Navigate to="/login" replace state={{ from: '/resume/build' }} />
    }

    // Reached without a job (a reload drops router state) — nothing to tailor to.
    if (!jobContext?.jobDescription) {
        return (
            <div className="mx-auto max-w-md px-4 py-20 text-center">
                <h1 className="text-xl font-semibold text-neutral-900">
                    Pick a job first
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                    Open a job portal and choose “Build resume with this” on a listing to
                    tailor your CV to it.
                </p>
                <button type="button" onClick={() => navigate('/')} className="cmn-button mt-6">
                    Browse jobs
                </button>
            </div>
        )
    }

    const selectedSection =
        resume?.sections.find((s) => s.id === selectedId) ?? null

    return (
        <div className="min-h-[calc(100dvh-8rem)] bg-neutral-50 print:bg-white">
            <div className="sticky top-14.5 z-10 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-sm md:top-17.5 print:hidden">
                <div className="mx-auto flex max-w-350 flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <Back />
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-semibold text-neutral-900">
                                Resume for {jobContext.jobTitle ?? 'this role'}
                            </h1>
                            <div className="flex items-center gap-1.5">
                                <p className="truncate text-[13px] text-neutral-600">
                                    {jobContext.company ?? 'Tailored from your saved CV'}
                                </p>
                                <JobDetailsDialog job={jobContext} />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (!cacheKey) return
                                clearCachedResume(cacheKey)
                                setResume(null)
                                setRegenerateKey((k) => k + 1)
                            }}
                            disabled={loading}
                            className="cmn-button-secondary"
                            title="Discards your edits and builds a fresh draft"
                        >
                            <RefreshCcw className="h-4 w-4" aria-hidden />
                            Regenerate
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            disabled={!resume}
                            className="cmn-button"
                        >
                            <Printer className="h-4 w-4" aria-hidden />
                            Save as PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-350 px-4 py-6 print:max-w-none print:p-0">
                {loading ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white py-20 text-sm text-neutral-600">
                        <Loader className="h-5 w-5 animate-spin" aria-hidden />
                        Writing a resume for this role…
                    </div>
                ) : error ? (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                ) : resume ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex items-start justify-center gap-5 print:block">
                            <SectionPalette onAdd={(bp) => addSection(bp)} />

                            {/* Canvas */}
                            <div className="min-w-0 flex-1 print:w-full">
                                <CanvasSheet
                                    onDeselect={() => {
                                        setSelectedId(null)
                                        setSelectedEntryId(null)
                                    }}
                                >
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger
                                          // A div, not a button: this is a
                                          // hover hint over a block of text,
                                          // and nothing here is clickable.
                                          render={<header className="mb-2 block cursor-default p-1" />}
                                        >
                                        <h1 className="text-2xl font-bold text-neutral-900">
                                            {resume.header.fullName}
                                        </h1>
                                        <p
                                            className="text-[13px] font-medium"
                                            style={{ color: accent }}
                                        >
                                            {resume.header.headline}
                                        </p>
                                        <p className="mt-1 text-[12px] text-neutral-600">
                                            {[
                                                resume.header.email,
                                                resume.header.phone,
                                                resume.header.location,
                                                ...resume.header.links,
                                            ]
                                                .filter(Boolean)
                                                .join('  ·  ')}
                                        </p>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            Your name and contact details come
                                            from your CV — update them in CV
                                            details to change them here.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <SortableContext
                                        items={resume.sections.map((s) => s.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div>
                                            {resume.sections.map((section) => (
                                                <SortableSection
                                                    key={section.id}
                                                    section={section}
                                                    accent={accent}
                                                    selected={section.id === selectedId}
                                                    selectedEntryId={selectedEntryId}
                                                    cv={cv}
                                                    rebuildBullet={
                                                        jobContext.jobDescription
                                                            ? rebuildBullet
                                                            : null
                                                    }
                                                    onSelectEntry={(entryId) => {
                                                        setSelectedId(section.id)
                                                        setSelectedEntryId(entryId)
                                                    }}
                                                    onSelect={() => {
                                                        setSelectedId(section.id)
                                                        setSelectedEntryId(null)
                                                    }}
                                                    onChange={(next) =>
                                                        setResume((p) =>
                                                            p
                                                                ? {
                                                                      ...p,
                                                                      sections: p.sections.map(
                                                                          (s) =>
                                                                              s.id === next.id
                                                                                  ? next
                                                                                  : s
                                                                      ),
                                                                  }
                                                                : p
                                                        )
                                                    }
                                                    onRemove={() => {
                                                        setResume((p) =>
                                                            p
                                                                ? {
                                                                      ...p,
                                                                      sections:
                                                                          p.sections.filter(
                                                                              (s) =>
                                                                                  s.id !==
                                                                                  section.id
                                                                          ),
                                                                  }
                                                                : p
                                                        )
                                                        setSelectedId(null)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </CanvasSheet>
                            </div>

                            <SectionProperties
                                section={selectedSection}
                                accent={accent}
                                onAccentChange={setAccent}
                                onStyleChange={updateStyle}
                                onApplyToAll={applyStyleToAll}
                            />
                        </div>
                    </DndContext>
                ) : null}
            </div>
        </div>
    )
}
