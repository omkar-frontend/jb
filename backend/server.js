const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { getJson } = require("serpapi");

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

/** Remotive is behind Cloudflare; default axios UA is often blocked (403). */
const remotiveHttpConfig = {
  timeout: 30_000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://remotive.com/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

const remotiveImageHeaders = {
  ...remotiveHttpConfig.headers,
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
};

/** Proxies job logos — direct requests to remotive.com/job/:id/logo often get 403 (hotlink / CF). */
app.get("/remotive/job/:id/logo", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!/^\d+$/.test(id)) {
    return res.status(400).end();
  }
  try {
    const response = await axios.get(`https://remotive.com/job/${id}/logo`, {
      timeout: remotiveHttpConfig.timeout,
      responseType: "arraybuffer",
      headers: remotiveImageHeaders,
      validateStatus: (s) => s === 200,
    });
    const ct = response.headers["content-type"] || "";
    if (ct.includes("text/html")) {
      return res.status(404).end();
    }
    if (ct) res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(404).end();
  }
});

/**
 * `/api/remote-jobs/categories` is often blocked (403 + CF challenge) while
 * `/api/remote-jobs` still returns JSON. We derive distinct category names from
 * a capped jobs fetch — the API accepts category name or slug per Remotive docs.
 */
const REMOTIVE_CATEGORY_STATIC_FALLBACK = [
  { name: "Software Development", slug: "software-dev" },
  { name: "Customer Service", slug: "customer-support" },
  { name: "Design", slug: "design" },
  { name: "Marketing", slug: "marketing" },
  { name: "Sales", slug: "sales" },
  { name: "Product", slug: "product" },
  { name: "Data", slug: "data" },
  { name: "DevOps", slug: "devops" },
  { name: "Writing", slug: "writing" },
  { name: "HR", slug: "hr" },
  { name: "Finance", slug: "finance" },
  { name: "Legal", slug: "legal" },
];

async function deriveRemotiveCategoriesFromJobs() {
  const response = await axios.get("https://remotive.com/api/remote-jobs", {
    ...remotiveHttpConfig,
    params: { limit: 400 },
  });
  const jobs = response.data?.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return null;
  }
  const names = new Set();
  for (const job of jobs) {
    const c = job?.category;
    if (typeof c === "string" && c.trim() !== "") {
      names.add(c.trim());
    }
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  return {
    jobs: sorted.map((name) => ({ name, slug: name })),
    _meta: { source: "derived_from_remote_jobs" },
  };
}

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

// GET job list from SERP (Google Jobs)
app.get("/serp/jobs", async (req, res) => {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "SERP API key is not set" });
  }

  const query = req.query.q != null && String(req.query.q).trim() !== ""
    ? String(req.query.q).trim()
    : req.query.query != null && String(req.query.query).trim() !== ""
      ? String(req.query.query).trim()
      : "Software Engineer";

  const location =
    req.query.location != null && String(req.query.location).trim() !== ""
      ? String(req.query.location).trim()
      : "United States";

  const googleDomain =
    req.query.google_domain != null && String(req.query.google_domain).trim() !== ""
      ? String(req.query.google_domain).trim()
      : "google.com";

  try {
    const params = {
      engine: "google_jobs",
      q: query,
      api_key: apiKey,
      google_domain: googleDomain,
      location,
    };

    const nextPageToken = req.query.next_page_token;
    if (nextPageToken != null && String(nextPageToken).trim() !== "") {
      params.next_page_token = String(nextPageToken).trim();
    }

    const uds = req.query.uds;
    if (uds != null && String(uds).trim() !== "") {
      params.uds = String(uds).trim();
    }

    getJson(params, (json) => {
      if (json.error) {
        console.error("SerpAPI error:", json.error);
        return res.status(500).json({ success: false, error: json.error });
      }
      res.json({ success: true, data: json });
    });
  } catch (err) {
    console.error("SERP API error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch jobs from SERP API",
    });
  }
});

/** Himalayas public API — proxy avoids browser CORS and keeps a single integration surface. */
const himalayasHttpConfig = {
  timeout: 30_000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://himalayas.app/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

app.get("/himalayas/jobs/search", async (req, res) => {
  try {
    const response = await axios.get(
      "https://himalayas.app/jobs/api/search",
      {
        ...himalayasHttpConfig,
        params: req.query,
      },
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    const status = err?.response?.status ?? 502;
    const body = err?.response?.data;
    const message =
      (typeof body?.errors === "string" && body.errors) ||
      (typeof body?.error === "string" && body.error) ||
      err?.message ||
      "Himalayas search failed";
    res.status(status).json({ success: false, error: String(message) });
  }
});

app.get("/himalayas/jobs/browse", async (req, res) => {
  try {
    const response = await axios.get("https://himalayas.app/jobs/api", {
      ...himalayasHttpConfig,
      params: req.query,
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    const status = err?.response?.status ?? 502;
    const body = err?.response?.data;
    const message =
      (typeof body?.errors === "string" && body.errors) ||
      (typeof body?.error === "string" && body.error) ||
      err?.message ||
      "Himalayas browse failed";
    res.status(status).json({ success: false, error: String(message) });
  }
});

/** Proxies Remotive public API (browser-safe; upstream may not send CORS headers). */
app.get("/remotive/remote-jobs", async (req, res) => {
  try {
    const response = await axios.get(
      "https://remotive.com/api/remote-jobs",
      {
        ...remotiveHttpConfig,
        params: req.query,
      },
    );
    res.json({ success: true, data: response.data });
  } catch (err) {
    const message =
      err?.response?.data?.message ?? err?.message ?? "Remotive request failed";
    const status = err?.response?.status ?? 502;
    res.status(status).json({ success: false, error: String(message) });
  }
});

/** Remotive job categories (names/slugs for the `category` filter). */
app.get("/remotive/remote-jobs/categories", async (req, res) => {
  try {
    const response = await axios.get(
      "https://remotive.com/api/remote-jobs/categories",
      {
        ...remotiveHttpConfig,
        validateStatus: (s) => s === 200 || s === 403 || s === 429,
      },
    );
    if (response.status === 200 && response.data) {
      return res.json({
        success: true,
        data: response.data,
        meta: { source: "remotive_categories_endpoint" },
      });
    }
  } catch (err) {
    // 403 CF / network / 5xx — fall through to derived or static fallback
    void err;
  }

  try {
    const derived = await deriveRemotiveCategoriesFromJobs();
    if (derived?.jobs?.length) {
      return res.json({
        success: true,
        data: derived,
        meta: {
          source: "derived_from_remote_jobs",
          note:
            "Official categories URL was unavailable; categories are inferred from current job listings.",
        },
      });
    }
  } catch (e) {
    console.warn("Remotive category derive failed:", e?.message ?? e);
  }

  return res.json({
    success: true,
    data: { jobs: REMOTIVE_CATEGORY_STATIC_FALLBACK },
    meta: {
      source: "static_fallback",
      note: "Using a built-in category list; refine with Search or type a category.",
    },
  });
});

/** OpenWeb Ninja JSearch — API key stays on the server (`x-api-key`). See https://www.openwebninja.com/api/jsearch/docs */
const JSEARCH_BASE = "https://api.openwebninja.com/jsearch";

const jsearchAllowedSearchParams = new Set([
  "query",
  "page",
  "num_pages",
  "country",
  "language",
  "date_posted",
  "work_from_home",
  "employment_types",
  "job_requirements",
  "radius",
  "exclude_job_publishers",
  "fields",
]);

app.get("/jsearch/search", async (req, res) => {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ success: false, error: "JSearch API key is not set" });
  }

  const params = {};
  for (const key of jsearchAllowedSearchParams) {
    const value = req.query[key];
    if (value != null && String(value).trim() !== "") {
      params[key] = String(value).trim();
    }
  }

  if (!params.query) {
    params.query = "software developer jobs";
  }

  console.log(params);

  try {
    const response = await axios.get(`${JSEARCH_BASE}/search`, {
      timeout: 30_000,
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      params,
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    const status = err?.response?.status ?? 502;
    const body = err?.response?.data;
    const message =
      (typeof body === "object" &&
        body != null &&
        (body.message || body.error || body.status)) ||
      err?.message ||
      "JSearch search failed";
    const str =
      typeof message === "string" ? message : JSON.stringify(message);
    res.status(status).json({ success: false, error: String(str) });
  }
});

const jsearchAllowedJobDetailsParams = new Set([
  "job_id",
  "country",
  "language",
  "fields",
]);

app.get("/jsearch/job-details", async (req, res) => {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ success: false, error: "JSearch API key is not set" });
  }

  const params = {};
  for (const key of jsearchAllowedJobDetailsParams) {
    const value = req.query[key];
    if (value != null && String(value).trim() !== "") {
      params[key] = String(value).trim();
    }
  }

  if (!params.job_id) {
    return res
      .status(400)
      .json({ success: false, error: "job_id is required" });
  }

  try {
    const response = await axios.get(`${JSEARCH_BASE}/job-details`, {
      timeout: 30_000,
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      params,
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    const status = err?.response?.status ?? 502;
    const body = err?.response?.data;
    const message =
      (typeof body === "object" &&
        body != null &&
        (body.message || body.error)) ||
      err?.message ||
      "JSearch job details failed";
    const str =
      typeof message === "string" ? message : JSON.stringify(message);
    res.status(status).json({ success: false, error: String(str) });
  }
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
