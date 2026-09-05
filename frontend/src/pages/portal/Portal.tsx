import { useParams } from "react-router-dom";
import NotFound from "../NotFound";
import Adzuna from "./Adzuna";
import GoogleJobs from "./GoogleJobs";
import Himalayas from "./Himalayas";
import JSearch from "./JSearch";
import Remotive from "./Remotive";

export default function Portal() {
    const { portal } = useParams();

    if (portal === "adzuna") return <Adzuna />;
    if (portal === "serp") return <GoogleJobs />;
    if (portal === "himalayas") return <Himalayas />;
    if (portal === "remotive") return <Remotive />;
    if (portal === "jsearch") return <JSearch />;

    // Unknown slug — a bare null left a blank page under the header.
    return (
        <NotFound
            title="Job portal not found"
            description={`There is no job portal called "${portal}".`}
        />
    );
}