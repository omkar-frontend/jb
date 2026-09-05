import { Suspense, lazy } from "react";
import { useParams } from "react-router-dom";
import InlineLoading from "../../components/InlineLoading";
import NotFound from "../NotFound";

// Each portal is ~500 lines plus its own filter data; splitting them keeps the
// five out of the initial bundle for visitors who only ever open one.
const Adzuna = lazy(() => import("./Adzuna"));
const GoogleJobs = lazy(() => import("./GoogleJobs"));
const Himalayas = lazy(() => import("./Himalayas"));
const JSearch = lazy(() => import("./JSearch"));
const Remotive = lazy(() => import("./Remotive"));

const PORTALS: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
    adzuna: Adzuna,
    serp: GoogleJobs,
    himalayas: Himalayas,
    remotive: Remotive,
    jsearch: JSearch,
};

export default function Portal() {
    const { portal } = useParams();
    const Selected = portal ? PORTALS[portal] : undefined;

    if (!Selected) {
        // Unknown slug — a bare null left a blank page under the header.
        return (
            <NotFound
                title="Job portal not found"
                description={`There is no job portal called "${portal}".`}
            />
        );
    }

    return (
        <Suspense
            fallback={
                <div className="flex min-h-[calc(100dvh-8rem)] items-start justify-center p-10">
                    <InlineLoading label="Loading portal…" />
                </div>
            }
        >
            <Selected />
        </Suspense>
    );
}
