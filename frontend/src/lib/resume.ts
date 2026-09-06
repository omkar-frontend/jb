import axios from 'axios'
import { api, isApiConfigured } from './api'

export type ResumeEntry = {
    id: string
    title: string
    subtitle: string | null
    period: string | null
    bullets: string[]
}

export type ResumeSectionKind = 'text' | 'entries' | 'tags'

/** Font stacks that exist on virtually every machine, so the printed PDF looks
 *  the same as the editor. Geist is the app font and is bundled. */
export const FONT_STACKS = {
    sans: "'Geist Variable', system-ui, -apple-system, sans-serif",
    serif: "Georgia, 'Times New Roman', Times, serif",
    slab: "'Iowan Old Style', 'Palatino Linotype', Palatino, serif",
    mono: "'SF Mono', Menlo, Consolas, monospace",
} as const

export type FontKey = keyof typeof FONT_STACKS

export type SectionStyle = {
    font: FontKey
    /** Body text size in px. Headings are derived from it. */
    fontSize: number
    fontWeight: number
    /** null = inherit the document body colour. */
    color: string | null
    /** null = use the document accent. */
    headingColor: string | null
    /** Space above the section, in px. */
    spacing: number
}

export const DEFAULT_SECTION_STYLE: SectionStyle = {
    font: 'sans',
    fontSize: 13,
    fontWeight: 400,
    color: null,
    headingColor: null,
    spacing: 10,
}

export type ResumeSection = {
    id: string
    heading: string
    kind: ResumeSectionKind
    text: string | null
    entries: ResumeEntry[]
    tags: string[]
    style: SectionStyle
}

export type ResumeHeader = {
    fullName: string
    headline: string
    email: string | null
    phone: string | null
    location: string | null
    links: string[]
}

export type Resume = {
    header: ResumeHeader
    sections: ResumeSection[]
}

/** 'ai' = written for this job by the model; 'cv' = built from the CV by rule. */
export type ResumeSource = 'ai' | 'cv'

export type TailorRequest = {
    jobTitle: string | null
    company: string | null
    jobDescription: string
}

type TailorApiResponse = {
    success: boolean
    data?: {
        resume: unknown
        jobTitle: string | null
        company: string | null
        /** 'cv' when the model was skipped, unavailable, or returned a resume
         *  that failed the server's truth checks — the resume then carries the
         *  candidate's own wording, which is still perfectly valid. */
        source?: ResumeSource
    }
    error?: string
}

let idCounter = 0
function ensureId(prefix: string, value: unknown): string {
    if (typeof value === 'string' && value.trim()) return value.trim()
    idCounter += 1
    return `${prefix}-${idCounter}`
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0)
}

function asNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * The model returns JSON that matches the requested schema most of the time.
 * Normalise it rather than trusting it: a missing array here would otherwise
 * crash the editor on first render.
 */
export function normalizeResume(raw: unknown): Resume | null {
    if (typeof raw !== 'object' || raw === null) return null
    const source = raw as Record<string, unknown>
    const header = (source.header ?? {}) as Record<string, unknown>

    const sections = Array.isArray(source.sections) ? source.sections : []

    const normalizedSections: ResumeSection[] = sections
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map((section) => {
            const rawKind = section.kind
            const kind: ResumeSectionKind =
                rawKind === 'entries' || rawKind === 'tags' || rawKind === 'text'
                    ? rawKind
                    : 'text'

            const entries: ResumeEntry[] = (
                Array.isArray(section.entries) ? section.entries : []
            )
                .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
                .map((entry) => ({
                    id: ensureId('entry', entry.id),
                    title: typeof entry.title === 'string' ? entry.title : '',
                    subtitle: asNullableString(entry.subtitle),
                    period: asNullableString(entry.period),
                    bullets: asStringArray(entry.bullets),
                }))

            // Gemini is not asked for styling — every section starts on the
            // document defaults and is customised in the editor.
            const rawStyle = (section.style ?? {}) as Partial<SectionStyle>

            return {
                id: ensureId('section', section.id),
                heading: typeof section.heading === 'string' ? section.heading : 'Section',
                kind,
                text: asNullableString(section.text),
                entries,
                tags: asStringArray(section.tags),
                style: { ...DEFAULT_SECTION_STYLE, ...rawStyle },
            }
        })
        // A section with nothing in it is noise on the page.
        .filter(
            (s) =>
                (s.kind === 'text' && s.text) ||
                (s.kind === 'entries' && s.entries.length > 0) ||
                (s.kind === 'tags' && s.tags.length > 0)
        )

    if (normalizedSections.length === 0) return null

    return {
        header: {
            fullName: typeof header.fullName === 'string' ? header.fullName : '',
            headline: typeof header.headline === 'string' ? header.headline : '',
            email: asNullableString(header.email),
            phone: asNullableString(header.phone),
            location: asNullableString(header.location),
            links: asStringArray(header.links),
        },
        sections: normalizedSections,
    }
}

/**
 * A tailored resume costs a Gemini call, and the builder requests one on mount —
 * so navigating away and back would re-bill for a resume the user already has,
 * and silently discard their edits. Module scope, so it survives route changes.
 */
const TAILOR_TTL_MS = 30 * 60 * 1000
const tailorCache = new Map<
    string,
    { at: number; resume: Resume; source: ResumeSource }
>()

export function tailorCacheKey(request: TailorRequest): string {
    // The description is the bulk of the input; its head plus length identifies
    // it without keeping a second copy of a 12k-character string as a key.
    return [
        request.jobTitle ?? '',
        request.company ?? '',
        request.jobDescription.length,
        request.jobDescription.slice(0, 200),
    ].join('|')
}

export function readCachedResume(
    key: string
): { resume: Resume; source: ResumeSource } | null {
    const hit = tailorCache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at >= TAILOR_TTL_MS) {
        tailorCache.delete(key)
        return null
    }
    return { resume: hit.resume, source: hit.source }
}

/** Also used to keep edits, so returning to a draft restores it as left. */
export function writeCachedResume(
    key: string,
    resume: Resume,
    source: ResumeSource
): void {
    tailorCache.set(key, { at: Date.now(), resume, source })
}

export function clearCachedResume(key: string): void {
    tailorCache.delete(key)
}

function tailorErrorMessage(err: unknown): string {
    if (
        axios.isAxiosError(err) &&
        typeof err.response?.data === 'object' &&
        err.response.data != null &&
        'error' in err.response.data &&
        typeof (err.response.data as { error?: unknown }).error === 'string'
    ) {
        return (err.response.data as { error: string }).error
    }
    return err instanceof Error ? err.message : 'Could not build your resume'
}

export async function tailorResume(
    request: TailorRequest,
    signal?: AbortSignal
): Promise<{ resume: Resume | null; source: ResumeSource; error: string | null }> {
    if (!isApiConfigured()) {
        return {
            resume: null,
            source: 'cv',
            error: 'Backend URL is not configured (VITE_BACKEND_URL).',
        }
    }

    try {
        const response = await api.post<TailorApiResponse>('/resume/tailor', request, {
            signal,
            timeout: 120_000,
        })

        if (!response.data.success || !response.data.data) {
            return {
                resume: null,
                source: 'cv',
                error: response.data.error ?? 'Could not build your resume',
            }
        }

        const resume = normalizeResume(response.data.data.resume)
        if (!resume) {
            return {
                resume: null,
                source: 'cv',
                error: 'The generated resume came back empty. Try again.',
            }
        }

        return {
            resume,
            source: response.data.data.source === 'ai' ? 'ai' : 'cv',
            error: null,
        }
    } catch (err) {
        return { resume: null, source: 'cv', error: tailorErrorMessage(err) }
    }
}


export type BulletRewriteRequest = {
    bullet: string
    jobTitle: string | null
    company: string | null
    jobDescription: string
    entryTitle: string
    entrySubtitle: string | null
}

type BulletRewriteApiResponse = {
    success: boolean
    data?: { bullet: string }
    error?: string
}

/**
 * Rewrites a single bullet. Kept separate from tailorResume so polishing one
 * weak line costs one cheap call rather than regenerating the document and
 * discarding every edit the user has already made.
 */
export async function rebuildBullet(
    request: BulletRewriteRequest,
    signal?: AbortSignal
): Promise<{ text: string | null; error: string | null }> {
    if (!isApiConfigured()) {
        return { text: null, error: 'Backend URL is not configured (VITE_BACKEND_URL).' }
    }

    try {
        const response = await api.post<BulletRewriteApiResponse>(
            '/resume/bullet',
            request,
            { signal, timeout: 60_000 }
        )

        if (!response.data.success || !response.data.data?.bullet) {
            return {
                text: null,
                error: response.data.error ?? 'Could not rewrite that line',
            }
        }

        return { text: response.data.data.bullet, error: null }
    } catch (err) {
        return { text: null, error: tailorErrorMessage(err) }
    }
}
