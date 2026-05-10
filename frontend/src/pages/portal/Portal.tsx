import { useParams } from "react-router-dom";
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
    return null;
}