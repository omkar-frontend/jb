import { Plus } from 'lucide-react'
import type { CvExtracted } from '../../lib/cvProfile'
import type { ResumeEntry, ResumeSection } from '../../lib/resume'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

/** Descriptions arrive as a blob or as a pasted bullet list; keep whatever
 *  structure the CV already had rather than inventing sentences. */
function toBullets(description: string | null): string[] {
    if (!description?.trim()) return []
    return description
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean)
}

function joinPeriod(start: string | null, end: string | null): string {
    return [start, end].filter(Boolean).join(' — ')
}

type Candidate = {
    key: string
    label: string
    sublabel: string | null
    apply: (section: ResumeSection) => ResumeSection
}

function makeEntry(
    prefix: string,
    index: number,
    entry: Omit<ResumeEntry, 'id'>
): (section: ResumeSection) => ResumeSection {
    return (section) => ({
        ...section,
        entries: [
            ...section.entries,
            { ...entry, id: `${prefix}-${index}-${section.entries.length}-${Date.now().toString(36)}` },
        ],
    })
}

function entryCandidates(cv: CvExtracted): Candidate[] {
    const fromExperience = cv.experience.map((job, i) => ({
        key: `exp-${i}`,
        label: job.title || 'Untitled role',
        sublabel:
            [job.company, joinPeriod(job.startDate, job.endDate)]
                .filter(Boolean)
                .join(' · ') || null,
        apply: makeEntry('cv-exp', i, {
            title: job.title,
            subtitle: job.company,
            period: joinPeriod(job.startDate, job.endDate),
            bullets: toBullets(job.description),
        }),
    }))

    const fromEducation = cv.education.map((edu, i) => ({
        key: `edu-${i}`,
        label: edu.degree || edu.institution || 'Education',
        sublabel: [edu.institution, edu.year].filter(Boolean).join(' · ') || null,
        apply: makeEntry('cv-edu', i, {
            title: edu.degree ?? '',
            subtitle: edu.institution,
            period: edu.year,
            bullets: [],
        }),
    }))

    return [...fromExperience, ...fromEducation]
}

function tagCandidates(cv: CvExtracted): Candidate[] {
    return [...cv.skills, ...cv.languages].map((value, i) => ({
        key: `tag-${i}-${value}`,
        label: value,
        sublabel: null,
        apply: (section: ResumeSection) => ({
            ...section,
            tags: [...section.tags, value],
        }),
    }))
}

function textCandidates(cv: CvExtracted): Candidate[] {
    if (!cv.summary?.trim()) return []
    const summary = cv.summary
    return [
        {
            key: 'summary',
            label: 'Professional summary',
            sublabel: summary.slice(0, 60) + (summary.length > 60 ? '…' : ''),
            apply: (section: ResumeSection) => ({ ...section, text: summary }),
        },
    ]
}

export default function CvPicker({
    section,
    cv,
    onChange,
}: {
    section: ResumeSection
    cv: CvExtracted | null
    onChange: (next: ResumeSection) => void
}) {
    if (!cv) return null

    const all =
        section.kind === 'entries'
            ? entryCandidates(cv)
            : section.kind === 'tags'
              ? tagCandidates(cv)
              : textCandidates(cv)

    // Hide what is already on the sheet, so the list shrinks as it is used.
    const used = new Set<string>(
        section.kind === 'entries'
            ? section.entries.map((e) =>
                  `${e.title}|${e.subtitle ?? ''}`.toLowerCase()
              )
            : section.kind === 'tags'
              ? section.tags.map((t) => t.toLowerCase())
              : []
    )

    const candidates = all.filter((candidate) => {
        if (section.kind === 'entries') {
            const company = candidate.sublabel?.split(' · ')[0] ?? ''
            return !used.has(`${candidate.label}|${company}`.toLowerCase())
        }
        if (section.kind === 'tags') return !used.has(candidate.label.toLowerCase())
        return true
    })

    if (candidates.length === 0) return null

    return (
        <Popover>
            <PopoverTrigger
                // The sheet deselects on background clicks and sections select on
                // click; neither should fire when opening this menu.
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded border border-dashed border-emerald-300 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50 print:hidden"
            >
                <Plus className="h-3 w-3" aria-hidden />
                From your CV
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1.5">
                <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    Saved CV
                </p>
                {candidates.map((candidate) => (
                    <button
                        key={candidate.key}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onChange(candidate.apply(section))
                        }}
                        className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-neutral-100"
                    >
                        <span className="block truncate text-[12.5px] font-medium text-neutral-800">
                            {candidate.label}
                        </span>
                        {candidate.sublabel ? (
                            <span className="block truncate text-[11px] text-neutral-500">
                                {candidate.sublabel}
                            </span>
                        ) : null}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    )
}
