import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Plus } from 'lucide-react'
import { BLOCK_BLUEPRINTS, type BlockBlueprint } from './blocks'

function PaletteItem({
    blueprint,
    onAdd,
}: {
    blueprint: BlockBlueprint
    onAdd: (blueprint: BlockBlueprint) => void
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: blueprint.paletteId,
        // Read back in onDragEnd to tell a palette drop from a reorder.
        data: { from: 'palette', blueprint },
    })

    return (
        <div
            ref={setNodeRef}
            className={`flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 ${
                isDragging ? 'opacity-40' : ''
            }`}
        >
            <button
                type="button"
                aria-label={`Drag ${blueprint.label} onto the resume`}
                className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-neutral-800">
                    {blueprint.label}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                    {blueprint.description}
                </p>
            </div>
            {/* Dragging is the headline interaction, but a click has to work too —
                touch users and keyboard users cannot drag. */}
            <button
                type="button"
                aria-label={`Add ${blueprint.label} section`}
                onClick={() => onAdd(blueprint)}
                className="rounded p-1 text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600"
            >
                <Plus className="h-4 w-4" aria-hidden />
            </button>
        </div>
    )
}

export default function SectionPalette({
    onAdd,
}: {
    onAdd: (blueprint: BlockBlueprint) => void
}) {
    return (
        // sticky lives on the aside: an inner sticky div is bounded by the
        // aside's own height, which is just its content, so it never moves.
        <aside className="sticky top-[120px] max-h-[calc(100dvh-140px)] w-56 shrink-0 self-start overflow-y-auto pb-4 md:top-[132px] print:hidden">
            <div className="space-y-2">
                <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Blocks
                </h2>
                {BLOCK_BLUEPRINTS.map((blueprint) => (
                    <PaletteItem
                        key={blueprint.paletteId}
                        blueprint={blueprint}
                        onAdd={onAdd}
                    />
                ))}
                <p className="px-1 pt-1 text-[11px] leading-relaxed text-neutral-400">
                    Drag a block onto the sheet, or press + to append it.
                </p>
            </div>
        </aside>
    )
}
