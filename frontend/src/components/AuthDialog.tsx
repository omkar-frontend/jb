import { useState } from 'react'
import AuthForm, { type AuthMode } from './AuthForm'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from './ui/dialog'

type AuthDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    description?: string
}

/**
 * Signing in without leaving the page. Navigating to /login would unmount the
 * caller and discard whatever it was holding — which is why the parsed CV used
 * to be copied into sessionStorage first. Keeping the user here removes the
 * need to persist that PII at all.
 */
export default function AuthDialog({
    open,
    onOpenChange,
    onSuccess,
    description,
}: AuthDialogProps) {
    const [mode, setMode] = useState<AuthMode>('login')

    const handleSuccess = () => {
        onOpenChange(false)
        onSuccess?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'login' ? 'Welcome back' : 'Create an account'}
                    </DialogTitle>
                    <DialogDescription>
                        {description ??
                            (mode === 'login'
                                ? 'Sign in to your account to continue'
                                : 'Sign up to save your preferences and CV data')}
                    </DialogDescription>
                </DialogHeader>

                {/* Remounts on mode change so fields and errors reset. */}
                <AuthForm key={mode} mode={mode} onSuccess={handleSuccess} autoFocus />

                <p className="mt-6 text-center text-sm text-neutral-600">
                    {mode === 'login' ? (
                        <>
                            Don&apos;t have an account?{' '}
                            <button
                                type="button"
                                onClick={() => setMode('signup')}
                                className="font-medium text-emerald-600 hover:text-emerald-700"
                            >
                                Sign up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => setMode('login')}
                                className="font-medium text-emerald-600 hover:text-emerald-700"
                            >
                                Sign in
                            </button>
                        </>
                    )}
                </p>
            </DialogContent>
        </Dialog>
    )
}
