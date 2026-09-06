import { HexColorPicker } from 'react-colorful'
import { Trash2 } from 'lucide-react'
import {
    FONT_STACKS,
    type FontKey,
    type ResumeSection,
    type SectionStyle,
} from '../../lib/resume'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const FONT_LABELS: Record<FontKey, string> = {
    sans: 'Sans (Geist)',
    serif: 'Serif (Georgia)',
    slab: 'Old style',
    mono: 'Mono',
}

const WEIGHTS = [
    { value: 400, label: 'Regular' },
    { value: 500, label: 'Medium' },
    { value: 600, label: 'Semibold' },
    { value: 700, label: 'Bold' },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-neutral-600">{label}</span>
            {children}
        </div>
    )
}

function ColorField({
    value,
    fallbackLabel,
    onChange,
    onReset,
}: {
    value: string | null
    fallbackLabel: string
    onChange: (next: string) => void
    onReset: () => void
}) {
    return (
        <div className="flex items-center gap-1">
            <Popover>
                <PopoverTrigger
                    aria-label="Pick colour"
                    className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-[12px] text-neutral-700 hover:bg-neutral-50"
                >
                    <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: value ?? 'transparent' }}
                        aria-hidden
                    />
                    {value ?? fallbackLabel}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                    <HexColorPicker color={value ?? '#334155'} onChange={onChange} />
                </PopoverContent>
            </Popover>
            {value ? (
                <button
                    type="button"
                    onClick={onReset}
                    aria-label="Reset colour"
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                >
                    <Trash2 className="h-3 w-3" aria-hidden />
                </button>
            ) : null}
        </div>
    )
}

export default function SectionProperties({
    section,
    accent,
    onAccentChange,
    onStyleChange,
    onApplyToAll,
}: {
    section: ResumeSection | null
    accent: string
    onAccentChange: (next: string) => void
    onStyleChange: (next: SectionStyle) => void
    onApplyToAll: (style: SectionStyle) => void
}) {
    const selectClass =
        'rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-800 outline-none focus:border-emerald-500'

    return (
        <aside className="sticky top-30 max-h-[calc(100dvh-140px)] w-64 shrink-0 self-start overflow-y-auto pb-4 md:top-41 print:hidden">
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-3">
                <div>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Document
                    </h2>
                    <div className="mt-2">
                        <Row label="Accent">
                            <ColorField
                                value={accent}
                                fallbackLabel="Accent"
                                onChange={onAccentChange}
                                onReset={() => onAccentChange('#059669')}
                            />
                        </Row>
                    </div>
                </div>

                <div className="border-t border-neutral-100 pt-3">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Section
                    </h2>

                    {!section ? (
                        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                            Select a section on the sheet to change its font, size,
                            weight, colour and spacing.
                        </p>
                    ) : (
                        <div className="mt-2 space-y-2.5">
                            <p className="truncate text-[12px] font-medium text-neutral-800">
                                {section.heading}
                            </p>

                            <Row label="Font">
                                <select
                                    className={selectClass}
                                    value={section.style.font}
                                    onChange={(e) =>
                                        onStyleChange({
                                            ...section.style,
                                            font: e.target.value as FontKey,
                                        })
                                    }
                                >
                                    {(Object.keys(FONT_STACKS) as FontKey[]).map((key) => (
                                        <option key={key} value={key}>
                                            {FONT_LABELS[key]}
                                        </option>
                                    ))}
                                </select>
                            </Row>

                            <Row label="Size">
                                <input
                                    type="number"
                                    min={9}
                                    max={22}
                                    value={section.style.fontSize}
                                    onChange={(e) =>
                                        onStyleChange({
                                            ...section.style,
                                            // Clamped: a resume set at 40px is not a resume.
                                            fontSize: Math.min(
                                                22,
                                                Math.max(9, Number(e.target.value) || 13)
                                            ),
                                        })
                                    }
                                    className={`${selectClass} w-16`}
                                />
                            </Row>

                            <Row label="Weight">
                                <select
                                    className={selectClass}
                                    value={section.style.fontWeight}
                                    onChange={(e) =>
                                        onStyleChange({
                                            ...section.style,
                                            fontWeight: Number(e.target.value),
                                        })
                                    }
                                >
                                    {WEIGHTS.map((w) => (
                                        <option key={w.value} value={w.value}>
                                            {w.label}
                                        </option>
                                    ))}
                                </select>
                            </Row>

                            <Row label="Text">
                                <ColorField
                                    value={section.style.color}
                                    fallbackLabel="Default"
                                    onChange={(color) =>
                                        onStyleChange({ ...section.style, color })
                                    }
                                    onReset={() =>
                                        onStyleChange({ ...section.style, color: null })
                                    }
                                />
                            </Row>

                            <Row label="Heading">
                                <ColorField
                                    value={section.style.headingColor}
                                    fallbackLabel="Accent"
                                    onChange={(headingColor) =>
                                        onStyleChange({ ...section.style, headingColor })
                                    }
                                    onReset={() =>
                                        onStyleChange({
                                            ...section.style,
                                            headingColor: null,
                                        })
                                    }
                                />
                            </Row>

                            <Row label="Space above">
                                <input
                                    type="number"
                                    min={0}
                                    max={64}
                                    value={section.style.spacing}
                                    onChange={(e) =>
                                        onStyleChange({
                                            ...section.style,
                                            spacing: Math.min(
                                                64,
                                                Math.max(0, Number(e.target.value) || 0)
                                            ),
                                        })
                                    }
                                    className={`${selectClass} w-16`}
                                />
                            </Row>

                            <button
                                type="button"
                                onClick={() => onApplyToAll(section.style)}
                                className="cmn-button-secondary w-full justify-center"
                            >
                                Apply to all sections
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    )
}
