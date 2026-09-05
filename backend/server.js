const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getJson } = require("serpapi");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "SUPABASE_URL or SUPABASE_ANON_KEY missing — /auth/me will not work until set in .env"
  );
}

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const app = express();

const PORT = Number(process.env.PORT) || 5001;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Browsers send an origin with no trailing slash, so a configured
 *  "https://site.com/" would silently never match. */
function normalizeOrigin(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

/** FRONTEND_URL accepts a comma-separated list, e.g. the prod URL plus localhost. */
const allowedOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

/** Optional regex for Vercel-style preview deploys, e.g. ^https://jb-[a-z0-9-]+\.vercel\.app$ */
let previewOriginPattern = null;
if (process.env.FRONTEND_ORIGIN_REGEX) {
  try {
    previewOriginPattern = new RegExp(process.env.FRONTEND_ORIGIN_REGEX);
  } catch (err) {
    console.error(
      `FRONTEND_ORIGIN_REGEX is not a valid regular expression: ${err.message}`
    );
    process.exit(1);
  }
}

// Fail closed: in production a missing allowlist must stop the server, not
// silently fall back to allowing every origin.
if (IS_PRODUCTION && allowedOrigins.length === 0) {
  console.error(
    "FRONTEND_URL is required when NODE_ENV=production.\n" +
      "Set it to the exact frontend origin (no trailing slash), e.g.\n" +
      "  FRONTEND_URL=https://your-app.vercel.app\n" +
      "Multiple origins may be comma-separated."
  );
  process.exit(1);
}

if (allowedOrigins.length === 0) {
  console.warn(
    "FRONTEND_URL is not set — allowing all origins. This is for local development only."
  );
}

function isOriginAllowed(origin) {
  const candidate = normalizeOrigin(origin);
  if (allowedOrigins.includes(candidate)) return true;
  if (previewOriginPattern?.test(candidate)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header: same-origin navigations, curl, server-to-server. CORS
    // has nothing to protect there, and rejecting would break the logo proxy.
    if (!origin) return callback(null, true);

    // Dev convenience only — unreachable in production because of the exit above.
    if (allowedOrigins.length === 0 && !previewOriginPattern) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) return callback(null, true);

    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Browsers load the Remotive logo proxy from a different origin than this API,
// so CORP must stay cross-origin or those <img> requests are blocked.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.use(express.json());

/**
 * Hosting platforms (Render, Railway, Fly, nginx) put this server behind a proxy,
 * so req.ip is the proxy's address unless we opt in. Rate limiting keys on req.ip,
 * so getting this wrong either buckets every visitor together (limit unset) or
 * lets clients spoof X-Forwarded-For (limit too loose). Set TRUST_PROXY=1 on such
 * hosts; leave it unset locally.
 */
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
  const hops = Number(TRUST_PROXY);
  app.set("trust proxy", Number.isFinite(hops) ? hops : TRUST_PROXY);
}

/**
 * Verifying a JWT costs a round trip to Supabase, and optionalAuth runs on every
 * request. Cache the lookup briefly, including negative results, so a signed-in
 * user browsing job portals does not generate one auth call per request.
 */
const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_MAX_ENTRIES = 1000;
const authCache = new Map();

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function resolveUserFromToken(token) {
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  if (cached) authCache.delete(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  const resolved = error || !user ? null : user;

  // Map preserves insertion order, so the first key is the oldest entry.
  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldest = authCache.keys().next().value;
    if (oldest !== undefined) authCache.delete(oldest);
  }
  authCache.set(token, { user: resolved, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });

  return resolved;
}

/**
 * Populates req.authUser when a valid session is present, and never rejects.
 * Anonymous access stays fully supported — this only decides who the rate
 * limiters below apply to, and lets requireAuth stay a cheap check.
 */
async function optionalAuth(req, res, next) {
  req.authUser = null;
  req.accessToken = null;
  req.authUnavailable = false;

  const token = readBearerToken(req);
  if (!token || !supabase) return next();

  try {
    const user = await resolveUserFromToken(token);
    if (user) {
      req.authUser = user;
      req.accessToken = token;
    }
  } catch (err) {
    // Supabase unreachable — treat as anonymous, but let requireAuth answer 503
    // rather than 401 so a network blip does not look like a signed-out user.
    req.authUnavailable = true;
    console.error("Auth lookup failed:", err?.message ?? err);
  }

  next();
}

app.use(optionalAuth);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Signed-in users are exempt for now — flip `skip` here to meter them too.
 * Anonymous callers are keyed by IP.
 */
function anonymousRateLimit({ windowMs, limit, error }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => Boolean(req.authUser),
    handler: (req, res) => {
      res.status(429).json({ success: false, error });
    },
  });
}

/** Backstop against blunt hammering; generous enough for logo-heavy job pages. */
const globalLimiter = anonymousRateLimit({
  windowMs: 15 * MINUTE,
  limit: 600,
  error: "Too many requests. Please slow down, or sign in for unlimited access.",
});

/** Gemini bills per call, and each one carries up to 5 MB of upload. */
const cvExtractLimiter = anonymousRateLimit({
  windowMs: HOUR,
  limit: 5,
  error:
    "CV extraction limit reached. Sign in for unlimited extractions, or try again in an hour.",
});

/** SerpAPI and JSearch bill per search. */
const paidSearchLimiter = anonymousRateLimit({
  windowMs: HOUR,
  limit: 30,
  error:
    "Search limit reached. Sign in for unlimited searches, or try again in an hour.",
});

/** Adzuna/Himalayas/Remotive are free tiers with their own upstream quotas. */
const freeSearchLimiter = anonymousRateLimit({
  windowMs: HOUR,
  limit: 120,
  error: "Search limit reached. Sign in for unlimited searches, or try again in an hour.",
});

app.use(globalLimiter);

const CV_MAX_BYTES = 5 * 1024 * 1024;
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_BYTES },
});

const CV_ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const CV_EXTRACTION_PROMPT = `You are an expert resume/CV parser. Extract structured information from this document.
Return ONLY valid JSON (no markdown, no code fences) matching this schema:
{
  "fullName": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "summary": string | null,
  "designation": string | null,
  "role": string | null,
  "skills": string[],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "link": string | null
    }
  ],
  "experience": [
    {
      "title": string,
      "company": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "description": string | null
    }
  ],
  "education": [
    {
      "degree": string | null,
      "institution": string | null,
      "year": string | null
    }
  ],
  "languages": string[],
  "links": {
    "linkedin": string | null,
    "github": string | null,
    "portfolio": string | null,
    "other": string[]
  },
  "certifications": [
    {
      "name": string,
      "issuer": string | null,
      "year": string | null
    }
  ]
}
Use null for missing scalar fields and empty arrays when none found. Dates as written on the CV.`;

function parseGeminiJson(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function formatAuthUser(user) {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    phoneConfirmedAt: user.phone_confirmed_at ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    updatedAt: user.updated_at ?? null,
    metadata: user.user_metadata ?? {},
    providers: user.app_metadata?.providers ?? {},
    provider: user.app_metadata?.provider ?? null,
  };
}

/** Hard gate. optionalAuth has already done the token lookup for every request. */
function requireAuth(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: "Auth is not configured on the server",
    });
  }

  if (!readBearerToken(req)) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid Authorization header",
    });
  }

  if (req.authUnavailable) {
    return res.status(503).json({
      success: false,
      error: "Could not verify your session right now. Please try again.",
    });
  }

  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired session",
    });
  }

  next();
}

function getSupabaseAsUser(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

const JOBS_BOARD_SCHEMA = "jobs_board";
const PROFILE_TABLE = "user_details";

function formatProfileRow(row) {
  if (!row) return null;
  let extracted = null;
  if (row.extractedInformation) {
    try {
      extracted = JSON.parse(row.extractedInformation);
    } catch {
      extracted = row.extractedInformation;
    }
  }
  return {
    id: row.id,
    extractedInformation: extracted,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

async function findProfileForUser(supabaseUser, userId) {
  const { data, error } = await supabaseUser
    .schema(JOBS_BOARD_SCHEMA)
    .from(PROFILE_TABLE)
    .select(
      "id, extractedInformation, created_at, updated_at, created_by, updated_by"
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

/**
 * Express 4 does not catch promise rejections from async handlers: the
 * rejection escapes to the process, and Node >= 15 treats an unhandled
 * rejection as fatal — one Supabase socket reset would take the whole API
 * down. Funnelling rejections into next() turns them into a 500 instead.
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ success: true, data: formatAuthUser(req.authUser) });
});

app.post("/cv/extract", cvExtractLimiter, cvUpload.single("cv"), asyncHandler(async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ success: false, error: "Gemini API key is not configured" });
  }

  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, error: "Please upload a CV file (field: cv)" });
  }

  const mimeType = req.file.mimetype;
  if (!CV_ALLOWED_MIME.has(mimeType)) {
    return res.status(400).json({
      success: false,
      error: "Unsupported file type. Use PDF, TXT, DOC, or DOCX (max 5 MB).",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      // gemini-1.5-* retired on v1beta; override via GEMINI_MODEL (e.g. gemini-2.5-pro)
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64 = req.file.buffer.toString("base64");
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      { text: CV_EXTRACTION_PROMPT },
    ]);

    const rawText = result.response.text();
    let extracted;
    try {
      extracted = parseGeminiJson(rawText);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Could not parse CV data from Gemini response",
        raw: rawText,
      });
    }

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        mimeType,
        extracted,
      },
    });
  } catch (err) {
    // Gemini errors carry quota and model detail that the user cannot act on.
    console.error("[upstream:Gemini]", String(err?.message ?? err).slice(0, 500));
    res.status(502).json({
      success: false,
      error: "Could not read your CV right now. Please try again in a moment.",
    });
  }
}));

app.get("/cv/profile", requireAuth, asyncHandler(async (req, res) => {
  const supabaseUser = getSupabaseAsUser(req.accessToken);
  if (!supabaseUser) {
    return res.status(503).json({
      success: false,
      error: "Database is not configured on the server",
    });
  }

  const { data, error } = await findProfileForUser(
    supabaseUser,
    req.authUser.id
  );

  if (error) {
    console.error("CV profile select error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.json({
    success: true,
    data: formatProfileRow(data),
  });
}));

app.post("/cv/profile", requireAuth, asyncHandler(async (req, res) => {
  const supabaseUser = getSupabaseAsUser(req.accessToken);
  if (!supabaseUser) {
    return res.status(503).json({
      success: false,
      error: "Database is not configured on the server",
    });
  }

  const payload = req.body?.extractedInformation ?? req.body?.extracted;
  if (payload == null) {
    return res.status(400).json({
      success: false,
      error: "Missing extractedInformation in request body",
    });
  }

  const serialized =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  const now = new Date().toISOString();
  const userId = req.authUser.id;

  const { data: existing, error: findError } = await findProfileForUser(
    supabaseUser,
    userId
  );

  if (findError) {
    console.error("CV profile lookup error:", findError.message);
    return res.status(500).json({ success: false, error: findError.message });
  }

  if (existing?.id) {
    const { data, error } = await supabaseUser
      .schema(JOBS_BOARD_SCHEMA)
      .from(PROFILE_TABLE)
      .update({
        extractedInformation: serialized,
        updated_at: now,
        updated_by: userId,
      })
      .eq("id", existing.id)
      .eq("created_by", userId)
      .select(
        "id, extractedInformation, created_at, updated_at, created_by, updated_by"
      )
      .single();

    if (error) {
      console.error("CV profile update error:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data: formatProfileRow(data) });
  }

  const { data, error } = await supabaseUser
    .schema(JOBS_BOARD_SCHEMA)
    .from(PROFILE_TABLE)
    .insert({
      extractedInformation: serialized,
      created_by: userId,
      created_at: now,
      updated_at: now,
      updated_by: userId,
    })
    .select(
      "id, extractedInformation, created_at, updated_at, created_by, updated_by"
    )
    .single();

  if (error) {
    console.error("CV profile insert error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(201).json({ success: true, data: formatProfileRow(data) });
}));

app.put("/cv/profile", requireAuth, asyncHandler(async (req, res) => {
  const supabaseUser = getSupabaseAsUser(req.accessToken);
  if (!supabaseUser) {
    return res.status(503).json({
      success: false,
      error: "Database is not configured on the server",
    });
  }

  const payload = req.body?.extractedInformation ?? req.body?.extracted;
  if (payload == null) {
    return res.status(400).json({
      success: false,
      error: "Missing extractedInformation in request body",
    });
  }

  const serialized =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  const now = new Date().toISOString();
  const userId = req.authUser.id;

  const { data: existing, error: findError } = await findProfileForUser(
    supabaseUser,
    userId
  );

  if (findError) {
    console.error("CV profile lookup error:", findError.message);
    return res.status(500).json({ success: false, error: findError.message });
  }

  if (!existing?.id) {
    return res.status(404).json({
      success: false,
      error: "No saved CV profile found for this user",
    });
  }

  const { data, error } = await supabaseUser
    .schema(JOBS_BOARD_SCHEMA)
    .from(PROFILE_TABLE)
    .update({
      extractedInformation: serialized,
      updated_at: now,
      updated_by: userId,
    })
    .eq("id", existing.id)
    .eq("created_by", userId)
    .select(
      "id, extractedInformation, created_at, updated_at, created_by, updated_by"
    )
    .single();

  if (error) {
    console.error("CV profile update error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.json({ success: true, data: formatProfileRow(data) });
}));

/**
 * Identical proxy requests repeat constantly — every visitor's Home page asks
 * for the same categories, and popular designations produce the same searches.
 * SerpAPI and JSearch bill per call, so serving those from memory for a few
 * minutes is the difference between one upstream call and hundreds.
 *
 * Only successful responses are stored: an upstream failure must be retried,
 * not remembered. Nothing user-specific is cached — these routes are the public
 * job-provider proxies, never /auth/me or /cv/profile.
 */
const RESPONSE_CACHE_MAX_ENTRIES = 500;
const responseCache = new Map();

function cacheKeyFor(req) {
  const params = Object.entries(req.query)
    .map(([k, v]) => [k, String(v)])
    .sort(([a], [b]) => a.localeCompare(b));
  return `${req.path}?${new URLSearchParams(params).toString()}`;
}

function cacheResponse(ttlMs) {
  return (req, res, next) => {
    const key = cacheKeyFor(req);

    const hit = responseCache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      res.set("X-Cache", "HIT");
      return res.json(hit.body);
    }
    if (hit) responseCache.delete(key);

    const sendJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body && body.success !== false) {
        // Map keeps insertion order, so the first key is the oldest entry.
        if (responseCache.size >= RESPONSE_CACHE_MAX_ENTRIES) {
          const oldest = responseCache.keys().next().value;
          if (oldest !== undefined) responseCache.delete(oldest);
        }
        responseCache.set(key, { at: Date.now(), body });
      }
      res.set("X-Cache", "MISS");
      return sendJson(body);
    };

    next();
  };
}

const CACHE_TTL_CATEGORIES = 30 * MINUTE;
const CACHE_TTL_SEARCH = 5 * MINUTE;
const CACHE_TTL_JOB_DETAILS = 30 * MINUTE;

/**
 * Upstream failures must not reach the browser verbatim. The provider's own
 * error text describes OUR account (plan tier, quota state, whether the key is
 * valid), and transport errors expose infrastructure detail. Reusing the
 * upstream status is worse still: an upstream 401 is not "your session
 * expired", and an upstream 429 is not our rate limiter — the frontend cannot
 * tell them apart. So log the detail and answer with a gateway error.
 *
 * Never log err.config.url: the Adzuna key travels in the query string.
 */
function respondUpstreamError(res, err, provider) {
  const upstreamStatus = err?.response?.status ?? null;
  const body = err?.response?.data;
  let detail;
  if (body != null) {
    detail = typeof body === "string" ? body : JSON.stringify(body);
  } else {
    detail = String(err?.message ?? err);
  }
  console.error(
    `[upstream:${provider}]`,
    upstreamStatus ? `status=${upstreamStatus}` : `code=${err?.code ?? "none"}`,
    detail.slice(0, 500)
  );

  const timedOut =
    err?.code === "ECONNABORTED" ||
    err?.code === "ETIMEDOUT" ||
    /timeout/i.test(String(err?.message ?? ""));

  if (timedOut) {
    return res.status(504).json({
      success: false,
      error: `${provider} took too long to respond. Please try again.`,
    });
  }

  return res.status(502).json({
    success: false,
    error: `${provider} is unavailable right now. Please try again later.`,
  });
}

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
app.get("/remotive/job/:id/logo", asyncHandler(async (req, res) => {
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
}));

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
    respondUpstreamError(res, err, "Adzuna");
  }
};

app.get("/adzuna/categories", freeSearchLimiter, cacheResponse(CACHE_TTL_CATEGORIES), asyncHandler(async (req, res) => {
  await adzunaRequest("/jobs/gb/categories", res);
}));

/**
 * Mirrors Adzuna: GET /jobs/{country}/search/{page}?category={tag}
 * Example: GET /adzuna/jobs/gb/search/0?category=it-jobs
 */
app.get("/adzuna/jobs/:country/search/:page", freeSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
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
}));

// GET job list from SERP (Google Jobs)
app.get("/serp/jobs", paidSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
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
        // SerpAPI reports failures in the body, not by throwing.
        console.error("[upstream:Google Jobs]", String(json.error).slice(0, 500));
        return res.status(502).json({
          success: false,
          error: "Google Jobs is unavailable right now. Please try again later.",
        });
      }
      res.json({ success: true, data: json });
    });
  } catch (err) {
    respondUpstreamError(res, err, "Google Jobs");
  }
}));

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

app.get("/himalayas/jobs/search", freeSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
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
    respondUpstreamError(res, err, "Himalayas");
  }
}));

app.get("/himalayas/jobs/browse", freeSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
  try {
    const response = await axios.get("https://himalayas.app/jobs/api", {
      ...himalayasHttpConfig,
      params: req.query,
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    respondUpstreamError(res, err, "Himalayas");
  }
}));

/** Proxies Remotive public API (browser-safe; upstream may not send CORS headers). */
app.get("/remotive/remote-jobs", freeSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
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
    respondUpstreamError(res, err, "Remotive");
  }
}));

/** Remotive job categories (names/slugs for the `category` filter). */
app.get("/remotive/remote-jobs/categories", freeSearchLimiter, cacheResponse(CACHE_TTL_CATEGORIES), asyncHandler(async (req, res) => {
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
}));

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

app.get("/jsearch/search", paidSearchLimiter, cacheResponse(CACHE_TTL_SEARCH), asyncHandler(async (req, res) => {
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
    respondUpstreamError(res, err, "JSearch");
  }
}));

const jsearchAllowedJobDetailsParams = new Set([
  "job_id",
  "country",
  "language",
  "fields",
]);

app.get("/jsearch/job-details", paidSearchLimiter, cacheResponse(CACHE_TTL_JOB_DETAILS), asyncHandler(async (req, res) => {
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
    respondUpstreamError(res, err, "JSearch");
  }
}));

// No route matched. Every other response here is JSON, so this must be too —
// the frontend reads `error` off the body and would choke on Express's HTML.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Not found: ${req.method} ${req.path.slice(0, 100)}`,
  });
});

// Final error handler. Without one, Express's default replies with an HTML
// stack trace whenever NODE_ENV is not "production", exposing the error text
// and absolute server paths. Detail belongs in the logs, not the response.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, error: "File must be 5 MB or smaller." });
    }
    return res.status(400).json({ success: false, error: err.message });
  }

  console.error(
    `[error] ${req.method} ${req.originalUrl}`,
    err?.stack ?? err?.message ?? err
  );

  // Mid-response failure: the status line is already gone, so let Express's
  // default handler destroy the socket rather than corrupting the body.
  if (res.headersSent) return next(err);

  res.status(500).json({ success: false, error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/**
 * Backstop for rejections that escape a handler entirely (a stray promise in a
 * callback, a timer). Logging keeps the process alive where Node would
 * otherwise exit; the request that caused it still fails, but the API stays up.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason?.stack ?? reason);
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
