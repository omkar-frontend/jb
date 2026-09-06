import { useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader, Sparkles, Trash2 } from 'lucide-react'
import type { CvExtracted } from '../../lib/cvProfile'
import {
    FONT_STACKS,
    type ResumeEntry,
    type ResumeSection,
    type RewriteKind,
} from '../../lib/resume'
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

export type RebuildText = (
    text: string,
    context: {
        kind: RewriteKind
        entryTitle?: string
        entrySubtitle?: string | null
    }
) => Promise<{ text: string | null; error: string | null }>

/**
 * One rewrite target — a bullet, or the summary. Owns its own pending and error
 * state so a failure on one line says nothing about any other, and so the two
 * call sites do not each reimplement the same three pieces of state.
 */
function RewriteAction({
    value,
    kind,
    entryTitle,
    entrySubtitle,
    rebuild,
    onRewritten,
    revealed,
}: {
    value: string
    kind: RewriteKind
    entryTitle?: string
    entrySubtitle?: string | null
    rebuild: RebuildText | null
    onRewritten: (next: string) => void
    /** Focus reveals the button; hover is only a shortcut to the same thing. */
    revealed: boolean
}) {
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!rebuild || !value.trim()) return null

    const run = async () => {
        setRunning(true)
        setError(null)
        const { text, error: failed } = await rebuild(value, {
            kind,
            entryTitle,
            entrySubtitle,
        })
        setRunning(false)
        if (failed || !text) {
            setError(failed ?? 'Could not rewrite that')
            return
        }
        onRewritten(text)
    }

    return (
        <>
            <button
                type="button"
                // onMouseDown, not onClick: the editable field blurs first and
                // its re-render would otherwise move the button out from under
                // the pointer before the click lands.
                onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void run()
                }}
                disabled={running}
                className={`ml-2 inline-flex items-center gap-1 rounded border border-emerald-200 px-1.5 py-0.5 align-middle text-[10px] text-emerald-700 transition-opacity hover:bg-emerald-50 disabled:opacity-50 print:hidden ${
                    revealed ? 'opacity-100' : 'opacity-0 group-hover/rw:opacity-100'
                }`}
            >
                {running ? (
                    <Loader className="h-2.5 w-2.5 animate-spin" aria-hidden />
                ) : (
                    <Sparkles className="h-2.5 w-2.5" aria-hidden />
                )}
                Rebuild with AI
            </button>
            {error ? (
                <span className="ml-2 text-[10px] text-red-600 print:hidden">{error}</span>
            ) : null}
        </>
    )
}

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
    rebuildText,
}: {
    entry: ResumeEntry
    sectionId: string
    fontSize: number
    selected: boolean
    onSelect: () => void
    onChange: (next: ResumeEntry) => void
    onRemove: () => void
    rebuildText: RebuildText | null
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: entry.id, data: { type: 'entry', sectionId } })

    /** Which bullet is open for editing — only that one shows its rewrite button. */
    const [activeBullet, setActiveBullet] = useState<number | null>(null)

    const setBullets = (bullets: string[]) => onChange({ ...entry, bullets })

    return (
        <div
            ref={setNodeRef}
            // Measured in both the print and screen layout passes to convert a
            // printed offset back into a position on the editor's sheet.
            data-flow-anchor
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

            {/* Certifications and degrees carry no bullets, and an empty <ul>
                still took its mt-1, adding a stray gap under every such entry. */}
            {entry.bullets.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-relaxed marker:text-neutral-400">
                {entry.bullets.map((bullet, bulletIndex) => (
                    <li
                        key={`${entry.id}-b-${bulletIndex}`}
                        data-flow-anchor
                        className="group/rw"
                    >
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
                        <RewriteAction
                            value={bullet}
                            kind="bullet"
                            entryTitle={entry.title}
                            entrySubtitle={entry.subtitle}
                            rebuild={rebuildText}
                            revealed={activeBullet === bulletIndex}
                            onRewritten={(next) => {
                                const bullets = [...entry.bullets]
                                bullets[bulletIndex] = next
                                setBullets(bullets)
                            }}
                        />
                    </li>
                ))}
            </ul>
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
    rebuildText,
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
    rebuildText: RebuildText | null
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: section.id, data: { type: 'section' } })

    /** Whether the prose of a text section is being edited, which reveals its
     *  rewrite button the same way focusing a bullet reveals that line's. */
    const [textActive, setTextActive] = useState(false)

    const { style } = section
    const headingColor = style.headingColor ?? accent

    return (
        <section
            ref={setNodeRef}
            data-flow-anchor
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
            // print:ring-offset-0 is load-bearing, not belt-and-braces: Tailwind's
            // `ring-0` resolves to calc(0px + var(--tw-ring-offset-width)), so
            // with ring-offset-2 still set it draws a 2px ring instead of none —
            // which is why every section printed inside a box it never had on
            // screen, where no ring-* class makes the shadow transparent.
            className={`group relative rounded-lg p-1 ring-offset-2 transition-shadow print:ring-0 print:ring-offset-0 ${
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
                    <p className="group/rw leading-relaxed">
                        <Editable
                            ariaLabel="Section text"
                            placeholder="Write a short paragraph"
                            value={section.text ?? ''}
                            // Same contract as a bullet: clicking into the prose
                            // is what puts its rewrite button on screen.
                            onFocus={() => setTextActive(true)}
                            onChange={(text) => onChange({ ...section, text })}
                        />
                        <RewriteAction
                            value={section.text ?? ''}
                            kind="summary"
                            rebuild={rebuildText}
                            revealed={textActive}
                            onRewritten={(text) => onChange({ ...section, text })}
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
                <>
                    <div>
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
                                rebuildText={rebuildText}
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
                    </div>
                    {/* Outside the spaced list on purpose: Tailwind's space-y
                        margins target :not(:last-child), so a print-hidden
                        sibling at the end still pushed the last entry up and
                        left a gap under every section on the printed page. */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
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
                            className="text-[11px] text-neutral-400 hover:text-emerald-600"
                        >
                            + entry
                        </button>
                        <CvPicker section={section} cv={cv} onChange={onChange} />
                    </div>
                </>
            ) : null}
        </section>
    )
}
