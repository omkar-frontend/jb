import {
    DEFAULT_SECTION_STYLE,
    type ResumeSection,
    type ResumeSectionKind,
} from '../../lib/resume'

export type BlockBlueprint = {
    /** Palette id — distinct from the section ids it produces. */
    paletteId: string
    label: string
    description: string
    kind: ResumeSectionKind
    heading: string
}

/** The left-hand palette. Dragging one of these onto the sheet creates a section. */
export const BLOCK_BLUEPRINTS: BlockBlueprint[] = [
    {
        paletteId: 'block-summary',
        label: 'Summary',
        description: 'A short paragraph',
        kind: 'text',
        heading: 'Summary',
    },
    {
        paletteId: 'block-experience',
        label: 'Experience',
        description: 'Roles with bullets',
        kind: 'entries',
        heading: 'Experience',
    },
    {
        paletteId: 'block-projects',
        label: 'Projects',
        description: 'Work with bullets',
        kind: 'entries',
        heading: 'Projects',
    },
    {
        paletteId: 'block-education',
        label: 'Education',
        description: 'Degrees and dates',
        kind: 'entries',
        heading: 'Education',
    },
    {
        paletteId: 'block-skills',
        label: 'Skills',
        description: 'Tag list',
        kind: 'tags',
        heading: 'Skills',
    },
    {
        // 'entries', not 'text': a custom block is nearly always a heading with
        // bullets under it, and a text block offers no way to add one. Free
        // prose is still available through the Summary block.
        paletteId: 'block-custom',
        label: 'Custom',
        description: 'Heading with bullets',
        kind: 'entries',
        heading: 'Section',
    },
]

let created = 0

/** A new section is deliberately near-empty: placeholder prose on a resume is
 *  worse than a gap, because it ships if the user misses it. */
export function sectionFromBlueprint(blueprint: BlockBlueprint): ResumeSection {
    created += 1
    const id = `${blueprint.paletteId}-${Date.now().toString(36)}-${created}`

    return {
        id,
        heading: blueprint.heading,
        kind: blueprint.kind,
        text: blueprint.kind === 'text' ? '' : null,
        entries:
            blueprint.kind === 'entries'
                ? [
                      {
                          id: `${id}-entry-1`,
                          title: '',
                          subtitle: '',
                          period: '',
                          bullets: [''],
                      },
                  ]
                : [],
        tags: blueprint.kind === 'tags' ? [''] : [],
        style: { ...DEFAULT_SECTION_STYLE },
    }
}
