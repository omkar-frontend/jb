import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { CvExtracted } from '../../lib/cvProfile'
import { FONT_STACKS, type ResumeSection } from '../../lib/resume'
import CvPicker from './CvPicker'

/** contentEditable rather than inputs: the sheet itself is the editing surface. */
function Editable({
    value,
    onChange,
    className,
    ariaLabel,
}: {
    value: string
    onChange: (next: string) => void
    className?: string
    ariaLabel: string
}) {
    return (
        <span
            role="textbox"
            aria-label={ariaLabel}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            // Commit on blur so a re-render never fights the caret mid-word.
            onBlur={(e) => onChange(e.currentTarget.textContent ?? '')}
            className={`rounded-sm outline-none focus:bg-emerald-50/70 print:focus:bg-transparent ${className ?? ''}`}
        >
            {value}
        </span>
    )
}

export default function SortableSection({
    section,
    accent,
    selected,
    cv,
    onSelect,
    onChange,
    onRemove,
}: {
    section: ResumeSection
    accent: string
    selected: boolean
    /** Saved CV profile, so entries can be pulled in instead of retyped. */
    cv: CvExtracted | null
    onSelect: () => void
    onChange: (next: ResumeSection) => void
    onRemove: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: section.id })

    const { style } = section
    const headingColor = style.headingColor ?? accent

    return (
        <section
            ref={setNodeRef}
            onClick={onSelect}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                marginTop: style.spacing,
                fontFamily: FONT_STACKS[style.font],
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                color: style.color ?? undefined,
            }}
            className={`group relative rounded-lg py-1 ring-offset-2 transition-shadow print:ring-0 ${
                isDragging ? 'z-10 bg-white shadow-lg ring-1 ring-emerald-200' : ''
            } ${selected ? 'ring-2 ring-emerald-400/70 print:ring-0' : ''}`}
        >
            {/* Controls are screen-only — the printed sheet must be clean. */}
            <div className="absolute -left-10 top-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden bg-white p-1 rounded-lg border border-neutral-200">
                <button
                    type="button"
                    aria-label={`Reorder ${section.heading}`}
                    className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" aria-hidden />
                </button>
                <button
                    type="button"
                    aria-label={`Remove ${section.heading}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove()
                    }}
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                    <Trash2 className="h-4 w-4" aria-hidden />
                </button>
            </div>

            <h2
                className="mb-2 border-b pb-1 font-bold uppercase tracking-wider"
                style={{
                    color: headingColor,
                    borderColor: `${headingColor}40`,
                    fontSize: Math.max(10, style.fontSize - 2),
                }}
            >
                <Editable
                    ariaLabel="Section heading"
                    value={section.heading}
                    onChange={(heading) => onChange({ ...section, heading })}
                />
            </h2>

            {section.kind === 'text' ? (
                <>
                    <p className="leading-relaxed">
                        <Editable
                            ariaLabel="Section text"
                            value={section.text ?? ''}
                            onChange={(text) => onChange({ ...section, text })}
                        />
                    </p>
                    {!section.text?.trim() ? (
                        <div className="mt-1">
                            <CvPicker section={section} cv={cv} onChange={onChange} />
                        </div>
                    ) : null}
                </>
            ) : null}

            {section.kind === 'tags' ? (
                <div className="flex flex-wrap gap-1.5">
                    {section.tags.map((tag, i) => (
                        <span
                            key={`${section.id}-tag-${i}`}
                            className="rounded px-2 py-0.5"
                            style={{
                                backgroundColor: `${headingColor}14`,
                                color: headingColor,
                                fontSize: Math.max(9, style.fontSize - 1),
                            }}
                        >
                            <Editable
                                ariaLabel="Skill"
                                value={tag}
                                onChange={(next) => {
                                    const tags = [...section.tags]
                                    if (next.trim()) tags[i] = next
                                    else tags.splice(i, 1)
                                    onChange({ ...section, tags })
                                }}
                            />
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onChange({ ...section, tags: [...section.tags, 'New skill'] })
                        }}
                        className="rounded border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 print:hidden"
                    >
                        + skill
                    </button>
                    <CvPicker section={section} cv={cv} onChange={onChange} />
                </div>
            ) : null}

            {section.kind === 'entries' ? (
                <div className="space-y-3">
                    {section.entries.map((entry, entryIndex) => (
                        <div key={entry.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <p className="font-semibold">
                                    <Editable
                                        ariaLabel="Role title"
                                        value={entry.title}
                                        onChange={(title) => {
                                            const entries = [...section.entries]
                                            entries[entryIndex] = { ...entry, title }
                                            onChange({ ...section, entries })
                                        }}
                                    />
                                </p>
                                <p
                                    className="text-neutral-500"
                                    style={{ fontSize: Math.max(9, style.fontSize - 2) }}
                                >
                                    <Editable
                                        ariaLabel="Period"
                                        value={entry.period ?? ''}
                                        onChange={(period) => {
                                            const entries = [...section.entries]
                                            entries[entryIndex] = { ...entry, period }
                                            onChange({ ...section, entries })
                                        }}
                                    />
                                </p>
                            </div>
                            <p
                                className="text-neutral-600"
                                style={{ fontSize: Math.max(9, style.fontSize - 1) }}
                            >
                                <Editable
                                    ariaLabel="Company"
                                    value={entry.subtitle ?? ''}
                                    onChange={(subtitle) => {
                                        const entries = [...section.entries]
                                        entries[entryIndex] = { ...entry, subtitle }
                                        onChange({ ...section, entries })
                                    }}
                                />
                            </p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-relaxed marker:text-neutral-400">
                                {entry.bullets.map((bullet, bulletIndex) => (
                                    <li key={`${entry.id}-b-${bulletIndex}`}>
                                        <Editable
                                            ariaLabel="Bullet point"
                                            value={bullet}
                                            onChange={(next) => {
                                                const bullets = [...entry.bullets]
                                                if (next.trim()) bullets[bulletIndex] = next
                                                else bullets.splice(bulletIndex, 1)
                                                const entries = [...section.entries]
                                                entries[entryIndex] = { ...entry, bullets }
                                                onChange({ ...section, entries })
                                            }}
                                        />
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const entries = [...section.entries]
                                    entries[entryIndex] = {
                                        ...entry,
                                        bullets: [...entry.bullets, 'New bullet'],
                                    }
                                    onChange({ ...section, entries })
                                }}
                                className="mt-1 text-[11px] text-neutral-400 hover:text-emerald-600 print:hidden"
                            >
                                + bullet
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onChange({
                                ...section,
                                entries: [
                                    ...section.entries,
                                    {
                                        id: `${section.id}-entry-${section.entries.length + 1}-${Date.now().toString(36)}`,
                                        title: '',
                                        subtitle: '',
                                        period: '',
                                        bullets: [''],
                                    },
                                ],
                            })
                        }}
                        className="text-[11px] text-neutral-400 hover:text-emerald-600 print:hidden"
                    >
                        + entry
                    </button>
                    <CvPicker section={section} cv={cv} onChange={onChange} />
                </div>
            ) : null}
        </section>
    )
}
