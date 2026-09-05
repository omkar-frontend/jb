import { useState } from 'react'

/**
 * Page number that resets to `firstPage` whenever `signature` changes.
 *
 * Replaces the `useEffect(() => setPage(1), [...filters])` pattern, which fired
 * one render late: the fetch effect saw the new filters with the *old* page and
 * requested it, then the reset landed and it requested again. Adjusting during
 * render (React's documented "changing state when props change" pattern) means
 * the stale page is never observed, so only one request goes out.
 */
export function usePageReset(signature: string, firstPage: number) {
    const [page, setPage] = useState(firstPage)
    const [lastSignature, setLastSignature] = useState(signature)

    if (signature !== lastSignature) {
        setLastSignature(signature)
        setPage(firstPage)
    }

    return [page, setPage] as const
}
