import { useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader, Sparkles, Trash2 } from 'lucide-react'
import type { CvExtracted } from '../../lib/cvProfile'
import { FONT_STACKS, type ResumeEntry, type ResumeSection } from '../../lib/resume'
import CvPicker from './CvPicker'

/** contentEditable rather than inputs: the sheet itself is the editing surface. */
function Editable({
    value,
    onChange,
    className,
    ariaLabel,
    placeholder,
    onFocus,
}: {
    value: string
    onChange: (next: string) => void
    className?: string
    ariaLabel: string
    /** Shown only while the field is empty, and never in print. */
    placeholder?: string
    onFocus?: () => void
}) {
    return (
        <span
            role="textbox"
            aria-label={ariaLabel}
            data-placeholder={placeholder}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onFocus={onFocus}
            // Commit on blur so a re-render never fights the caret mid-word.
            onBlur={(e) => onChange(e.currentTarget.textContent ?? '')}
            className={`editable rounded-sm outline-none focus:bg-emerald-50/70 print:focus:bg-transparent ${className ?? ''}`}
        >
            {value}
        </span>
    )
}

/** Handles shared by sections and the entries inside them. */
function Controls({
    label,
    onRemove,
    dragProps,
    className,
}: {
    label: string
    onRemove: () => void
    dragProps: Record<string, unknown>
    className: string
}) {
    return (
        <div className={className}>
            <button
                type="button"
                aria-label={`Reorder ${label}`}
                className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                {...dragProps}
            >
                <GripVertical className="h-4 w-4" aria-hidden />
            </button>
            <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={(e) => {
                    e.stopPropagation()
                    onRemove()
                }}
                className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
                <Trash2 className="h-4 w-4" aria-hidden />
            </button>
        </div>
    )
}

export type RebuildBullet = (
    bullet: string,
    context: { entryTitle: string; entrySubtitle: string | null }
) => Promise<{ text: string | null; error: string | null }>

/**
 * One role, project or degree. Sortable in its own right: a section holds
 * several of these, and reordering jobs matters as much as reordering sections.
 */
function SortableEntry({
    entry,
    sectionId,
    fontSize,
    selected,
    onSelect,
    onChange,
    onRemove,
    rebuildBullet,
}: {
    entry: ResumeEntry
    sectionId: string
    fontSize: number
    selected: boolean
    onSelect: () => void
    onChange: (next: ResumeEntry) => void
    onRemove: () => void
    rebuildBullet: RebuildBullet | null
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: entry.id, data: { type: 'entry', sectionId } })

    /** Which bullet is open for editing — only that one offers the AI rewrite. */
    const [activeBullet, setActiveBullet] = useState<number | null>(null)
    const [rebuilding, setRebuilding] = useState<number | null>(null)
    const [rebuildError, setRebuildError] = useState<string | null>(null)

    const setBullets = (bullets: string[]) => onChange({ ...entry, bullets })

    const handleRebuild = async (index: number) => {
        const original = entry.bullets[index]
        if (!rebuildBullet || original === undefined) return
        setRebuilding(index)
        setRebuildError(null)
        const { text, error } = await rebuildBullet(original, {
            entryTitle: entry.title,
            entrySubtitle: entry.subtitle,
        })
        setRebuilding(null)
        if (error || !text) {
            setRebuildError(error ?? 'Could not rewrite that line')
            return
        }
        const bullets = [...entry.bullets]
        bullets[index] = text
        setBullets(bullets)
    }

    return (
        <div
            ref={setNodeRef}
            onClick={(e) => {
                e.stopPropagation()
                onSelect()
            }}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
            className={`entry group/entry relative rounded-md px-1 py-0.5 print:ring-0 ${
                isDragging ? 'z-10 bg-white shadow-md ring-1 ring-emerald-200' : ''
            } ${selected ? 'ring-1 ring-emerald-400/70 print:ring-0' : ''}`}
        >
            <Controls
                label={entry.title || 'entry'}
                onRemove={onRemove}
                dragProps={{ ...attributes, ...listeners }}
                className="absolute -left-9 top-[40%] flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5 opacity-0 transition-opacity group-hover/entry:opacity-100 print:hidden"
            />

            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold">
                    <Editable
                        ariaLabel="Role title"
                        placeholder="Title"
                        value={entry.title}
                        onChange={(title) => onChange({ ...entry, title })}
                    />
                </p>
                <p
                    className="text-neutral-500"
                    style={{ fontSize: Math.max(9, fontSize - 2) }}
                >
                    <Editable
                        ariaLabel="Period"
                        placeholder="Period"
                        value={entry.period ?? ''}
                        onChange={(period) => onChange({ ...entry, period })}
                    />
                </p>
            </div>
            <p className="text-neutral-600" style={{ fontSize: Math.max(9, fontSize - 1) }}>
                <Editable
                    ariaLabel="Company"
                    placeholder="Company or institution"
                    value={entry.subtitle ?? ''}
                    onChange={(subtitle) => onChange({ ...entry, subtitle })}
                />
            </p>

            <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-relaxed marker:text-neutral-400">
                {entry.bullets.map((bullet, bulletIndex) => (
                    <li key={`${entry.id}-b-${bulletIndex}`} className="group/bullet">
                        <Editable
                            ariaLabel="Bullet point"
                            placeholder="Describe what you did"
                            value={bullet}
                            // Clicking into a line is what puts its rewrite
                            // button on screen; hover is only a shortcut.
                            onFocus={() => setActiveBullet(bulletIndex)}
                            onChange={(next) => {
                                const bullets = [...entry.bullets]
                                if (next.trim()) bullets[bulletIndex] = next
                                else bullets.splice(bulletIndex, 1)
                                setBullets(bullets)
                            }}
                        />
                        {/* Rewriting one line at a time, so a single weak bullet
                            does not cost a rebuild of the whole document. */}
                        {rebuildBullet && bullet.trim() ? (
                            <button
                                type="button"
                                // onMouseDown, not onClick: the editable field
                                // blurs first and its re-render would otherwise
                                // move the button out from under the pointer.
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void handleRebuild(bulletIndex)
                                }}
                                disabled={rebuilding !== null}
                                className={`ml-2 inline-flex items-center gap-1 rounded border border-emerald-200 px-1.5 py-0.5 align-middle text-[10px] text-emerald-700 transition-opacity hover:bg-emerald-50 disabled:opacity-50 print:hidden ${
                                    activeBullet === bulletIndex
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover/bullet:opacity-100'
                                }`}
                            >
                                {rebuilding === bulletIndex ? (
                                    <Loader className="h-2.5 w-2.5 animate-spin" aria-hidden />
                                ) : (
                                    <Sparkles className="h-2.5 w-2.5" aria-hidden />
                                )}
                                Rebuild with AI
                            </button>
                        ) : null}
                    </li>
                ))}
            </ul>

            {rebuildError ? (
                <p className="mt-1 text-[10px] text-red-600 print:hidden">{rebuildError}</p>
            ) : null}

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setBullets([...entry.bullets, ''])
                }}
                className="mt-1 text-[11px] text-neutral-400 hover:text-emerald-600 print:hidden"
            >
                + bullet
            </button>
        </div>
    )
}

export default function SortableSection({
    section,
    accent,
    selected,
    selectedEntryId,
    cv,
    onSelect,
    onSelectEntry,
    onChange,
    onRemove,
    rebuildBullet,
}: {
    section: ResumeSection
    accent: string
    selected: boolean
    selectedEntryId: string | null
    /** Saved CV profile, so entries can be pulled in instead of retyped. */
    cv: CvExtracted | null
    onSelect: () => void
    onSelectEntry: (entryId: string) => void
    onChange: (next: ResumeSection) => void
    onRemove: () => void
    rebuildBullet: RebuildBullet | null
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: section.id, data: { type: 'section' } })

    const { style } = section
    const headingColor = style.headingColor ?? accent

    return (
        <section
            ref={setNodeRef}
            onClick={onSelect}
            style={{
                // Translate, not Transform: dnd-kit's sortable transform carries
                // scaleX/scaleY set from the ratio between the dragged item and
                // the one it is over, so a 200px Summary dragged across an 800px
                // Experience block stretched to match and snapped back on drop.
                transform: CSS.Translate.toString(transform),
                transition,
                marginTop: style.spacing,
                fontFamily: FONT_STACKS[style.font],
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                color: style.color ?? undefined,
            }}
            className={`group relative rounded-lg p-1 ring-offset-2 transition-shadow print:ring-0 ${
                isDragging ? 'z-10 bg-white shadow-lg ring-1 ring-emerald-200' : ''
            } ${selected ? 'ring-2 ring-emerald-400/70 print:ring-0' : ''}`}
        >
            {/* Controls are screen-only — the printed sheet must be clean. */}
            <Controls
                label={section.heading}
                onRemove={onRemove}
                dragProps={{ ...attributes, ...listeners }}
                className="absolute -left-14 top-2 flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden"
            />

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
                    placeholder="Heading"
                    value={section.heading}
                    onChange={(heading) => onChange({ ...section, heading })}
                />
            </h2>

            {section.kind === 'text' ? (
                <>
                    <p className="leading-relaxed">
                        <Editable
                            ariaLabel="Section text"
                            placeholder="Write a short paragraph"
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
                                placeholder="Skill"
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
                    <SortableContext
                        items={section.entries.map((entry) => entry.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {section.entries.map((entry, entryIndex) => (
                            <SortableEntry
                                key={entry.id}
                                entry={entry}
                                sectionId={section.id}
                                fontSize={style.fontSize}
                                selected={entry.id === selectedEntryId}
                                onSelect={() => onSelectEntry(entry.id)}
                                rebuildBullet={rebuildBullet}
                                onChange={(next) => {
                                    const entries = [...section.entries]
                                    entries[entryIndex] = next
                                    onChange({ ...section, entries })
                                }}
                                onRemove={() =>
                                    onChange({
                                        ...section,
                                        entries: section.entries.filter(
                                            (_, i) => i !== entryIndex
                                        ),
                                    })
                                }
                            />
                        ))}
                    </SortableContext>
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
