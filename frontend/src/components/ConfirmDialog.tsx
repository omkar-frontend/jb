import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from './ui/dialog'

type ConfirmDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: ReactNode
    /** Runs the destructive action. */
    onConfirm: () => void
    onCancel?: () => void
    confirmLabel?: string
    cancelLabel?: string
    /** 'danger' for actions that lose data, 'default' otherwise. */
    tone?: 'danger' | 'default'
}

export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
    onCancel,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
}: ConfirmDialogProps) {
    const handleOpenChange = (next: boolean) => {
        // Escape / backdrop click are a cancel, not a silent dismissal.
        if (!next) onCancel?.()
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-sm">
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            tone === 'danger'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-emerald-50 text-emerald-600'
                        }`}
                        aria-hidden
                    >
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <DialogTitle className="text-base">{title}</DialogTitle>
                        <DialogDescription className="mt-1">
                            {description}
                        </DialogDescription>
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            onCancel?.()
                            onOpenChange(false)
                        }}
                        className="cmn-button-secondary justify-center"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={
                            tone === 'danger'
                                ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-default'
                                : 'cmn-button justify-center'
                        }
                    >
                        {confirmLabel}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
