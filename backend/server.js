const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 5001;

const corsOptions = {
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

const adzunaRequest = async (urlPath, res, extraQueryParams = {}) => {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  try {
    const params = new URLSearchParams({
      app_id: String(appId),
      app_key: String(appKey),
      ...extraQueryParams,
    });
    const response = await axios.get(
      `https://api.adzuna.com/v1/api${urlPath}?${params.toString()}`
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    const message =
      err?.response?.data?.message ?? err?.message ?? "Adzuna request failed";
    const status = err?.response?.status ?? 502;
    res.status(status).json({ success: false, error: message });
  }
};

app.get("/adzuna/categories", async (req, res) => {
  await adzunaRequest("/jobs/gb/categories", res);
});

/**
 * Mirrors Adzuna: GET /jobs/{country}/search/{page}?category={tag}
 * Example: GET /adzuna/jobs/gb/search/0?category=it-jobs
 */
app.get("/adzuna/jobs/:country/search/:page", async (req, res) => {
  const { country, page } = req.params;
  const normalizedCountry =
    country != null && String(country).trim() !== ""
      ? String(country).trim().toLowerCase()
      : "gb";
  const extras = {};
  const allowedQueryParams = [
    "results_per_page",
    "what",
    "what_and",
    "what_phrase",
    "what_or",
    "what_exclude",
    "title_only",
    "where",
    "distance",
    "location0",
    "location1",
    "location2",
    "location3",
    "location4",
    "location5",
    "location6",
    "location7",
    "max_days_old",
    "category",
    "sort_dir",
    "sort_by",
    "salary_min",
    "salary_max",
    "salary_include_unknown",
    "full_time",
    "part_time",
  ];
  allowedQueryParams.forEach((key) => {
    const value = req.query[key];
    if (value != null && String(value).trim() !== "") {
      extras[key] = String(value).trim();
    }
  });
  await adzunaRequest(
    `/jobs/${encodeURIComponent(normalizedCountry)}/search/${encodeURIComponent(
      page
    )}`,
    res,
    extras,
  );
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server (e.g. another terminal tab) or run:\n` +
        `  lsof -i :${PORT}\n` +
        `Then kill that PID, or set a different PORT in .env (e.g. PORT=4000).`
    );
    process.exit(1);
  }
  throw err;
});
