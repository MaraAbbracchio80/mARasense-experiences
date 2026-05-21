require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const ALLOWED_ORIGINS = [
  "https://marasenseexperiences-ar.web.app",
  "https://marasenseexperiences-ar.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  return next();
});

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "80mb" }));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "MaraAbbracchio80";
const GITHUB_REPO = process.env.GITHUB_REPO || "mARasense-experiences";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

const BASE_URL = "https://marasenseexperiences-ar.web.app";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

const ALLOWED_SECTORS = [
  "food",
  "painting",
  "sport",
  "eventi",
  "matrimoni",
  "museo",
  "retail",
  "custom"
];

const ALLOWED_TYPES = [
  "ar-video",
  "ar-audio",
  "ar-video-audio",
  "multi-target"
];

const FALLBACK_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MaraSense Experience</title>
</head>
<body>
  <h1>MaraSense Experience</h1>
  <p>Template AR non trovato. Verifica managed-experiences/_template/index.html.</p>
</body>
</html>`;

function requireGithubToken() {
  if (!GITHUB_TOKEN) {
    const error = new Error("GITHUB_TOKEN mancante nel file .env.");
    error.statusCode = 500;
    throw error;
  }
}

function githubHeaders() {
  requireGithubToken();

  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidPathSegment(value) {
  if (!value) return false;
  if (typeof value !== "string") return false;
  if (value.includes("..")) return false;
  if (value.includes("/")) return false;
  if (value.includes("\\")) return false;
  return /^[a-z0-9._-]+$/i.test(value);
}

function isValidFilePayload(file) {
  if (!file) return false;
  if (typeof file !== "object") return false;
  if (!isValidPathSegment(file.path)) return false;
  if (!file.content || typeof file.content !== "string") return false;
  return true;
}

function encodeTextBase64(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

function decodeBase64(content) {
  return Buffer.from(content || "", "base64").toString("utf8");
}

function cleanBase64Content(value) {
  return String(value || "")
    .replace(/^data:.*?;base64,/, "")
    .replace(/\s/g, "");
}

function githubPathUrl(path) {
  return `${GITHUB_API_BASE}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}

async function githubGetFile(path) {
  try {
    const response = await axios.get(githubPathUrl(path), {
      headers: githubHeaders(),
      params: { ref: GITHUB_BRANCH }
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }

    throw error;
  }
}

async function githubPutFileBase64(path, base64Content, message, sha) {
  const body = {
    message,
    content: cleanBase64Content(base64Content),
    branch: GITHUB_BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await axios.put(githubPathUrl(path), body, {
    headers: githubHeaders()
  });

  return response.data;
}

async function githubPutFileText(path, content, message, sha) {
  return githubPutFileBase64(path, encodeTextBase64(content), message, sha);
}

async function readJsonFile(path, fallbackValue) {
  const existing = await githubGetFile(path);

  if (!existing) {
    return { value: fallbackValue, sha: null };
  }

  return {
    value: JSON.parse(decodeBase64(existing.content)),
    sha: existing.sha
  };
}

async function readTemplateHtml() {
  const templateFile = await githubGetFile("managed-experiences/_template/index.html");

  if (!templateFile || !templateFile.content) {
    return FALLBACK_TEMPLATE_HTML;
  }

  return decodeBase64(templateFile.content);
}

function normalizeExperiencePayload(body) {
  const sector = body.sector;
  const type = body.type;
  const name = body.name || body.title;
  const notes = body.notes || "";
  const slug = slugify(body.slug || name);

  const targetFile = body.targetFile || "targets.mind";
  const sharedImage = body.sharedImage || "shared.jpg";
  const contentFile = body.contentFile || "content-1.mp4";
  const options = body.options || {};

  const targetImages = Array.isArray(body.targetImages) ? body.targetImages : [];

  const contents = Array.isArray(body.contents) && body.contents.length > 0
    ? body.contents
    : [
        {
          id: 0,
          label: "Contenuto 1",
          targetId: 0,
          file: contentFile
        }
      ];

  const files = Array.isArray(body.files) ? body.files : [];

  return {
    sector,
    type,
    name,
    notes,
    slug,
    targetFile,
    sharedImage,
    contentFile,
    options,
    targetImages,
    contents,
    files
  };
}

function validateExperience(data) {
  if (!data.name || typeof data.name !== "string") return "Nome esperienza mancante.";
  if (!data.slug || !isValidPathSegment(data.slug)) return "Slug esperienza non valido.";
  if (!ALLOWED_SECTORS.includes(data.sector)) return "Settore non valido.";
  if (!ALLOWED_TYPES.includes(data.type)) return "Tipo esperienza non valido.";
  if (!isValidPathSegment(data.targetFile)) return "Nome file target non valido.";
  if (!isValidPathSegment(data.sharedImage)) return "Nome file shared non valido.";
  if (!isValidPathSegment(data.contentFile)) return "Nome file contenuto principale non valido.";
  if (!Array.isArray(data.contents) || data.contents.length === 0) return "Aggiungi almeno un contenuto.";

  for (const content of data.contents) {
    if (!isValidPathSegment(content.file)) {
      return `Nome file contenuto non valido: ${content.file}`;
    }
  }

  for (const target of data.targetImages) {
    if (target.file && target.file !== "-" && !isValidPathSegment(target.file)) {
      return `Nome file immagine target non valido: ${target.file}`;
    }
  }

  for (const file of data.files) {
    if (!isValidFilePayload(file)) {
      return "Payload file non valido.";
    }
  }

  return "";
}

function buildConfig(data, folder, publicUrl) {
  const firstContent = data.contents[0] || {
    file: data.contentFile,
    targetId: 0
  };

  return {
    title: data.name,
    type: data.type,
    sector: data.sector,
    targetFile: data.targetFile,
    sharedImage: data.sharedImage,
    contentFile: firstContent.file || data.contentFile,
    autoPlay: data.options.autoPlay !== false,
    requireContentEnd: data.options.requireContentEnd === true,
    stopOnTargetLost: data.options.stopOnTargetLost !== false,
    transparentBg: data.options.transparentBg !== false,
    lensUi: data.options.lensUi !== false,
    multiTarget:
      data.type === "multi-target" ||
      data.contents.length > 1 ||
      data.targetImages.length > 1,
    targetImages: data.targetImages.map((target, index) => ({
      id: Number.isInteger(target.id) ? target.id : index,
      label: target.label || `Target ${index + 1}`,
      file: target.file || "-",
      originalFile: target.originalFile || "-"
    })),
    contents: data.contents.map((content, index) => ({
      id: Number.isInteger(content.id) ? content.id : index,
      label: content.label || `Contenuto ${index + 1}`,
      targetId: Number.isInteger(content.targetId) ? content.targetId : 0,
      file: content.file,
      originalFile: content.originalFile || "-"
    })),
    targets: data.contents.map((content, index) => ({
      id: Number.isInteger(content.targetId) ? content.targetId : 0,
      content: content.file,
      label: content.label || `Contenuto ${index + 1}`
    })),
    meta: {
      slug: data.slug,
      notes: data.notes,
      generatedFolder: folder,
      publicUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

function buildIndexRecord(config, folder, publicUrl) {
  return {
    id: `${config.sector}/${config.meta.slug}`,
    name: config.title,
    title: config.title,
    sector: config.sector,
    type: config.type,
    slug: config.meta.slug,
    createdAt: config.meta.createdAt,
    updatedAt: config.meta.updatedAt,
    folder,
    publicUrl,
    sharedImage: config.sharedImage,
    targetFile: config.targetFile,
    contentFile: config.contentFile,
    targetImages: config.targetImages || [],
    contents: config.contents || [],
    targets: config.targets || []
  };
}

async function updateExperiencesIndex(record) {
  const indexPath = "managed-experiences/index.json";
  const { value, sha } = await readJsonFile(indexPath, []);
  const list = Array.isArray(value) ? value : [];
  const existingIndex = list.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    const previous = list[existingIndex];

    list[existingIndex] = {
      ...previous,
      ...record,
      createdAt: previous.createdAt || record.createdAt,
      updatedAt: record.updatedAt
    };
  } else {
    list.push(record);
  }

  await githubPutFileText(
    indexPath,
    JSON.stringify(list, null, 2) + "\n",
    `Update managed experiences index: ${record.name}`,
    sha
  );

  return list;
}

async function writeUploadedFiles(folder, files, experienceName) {
  const writtenFiles = [];

  for (const file of files) {
    const path = `${folder}${file.path}`;
    const existing = await githubGetFile(path);

    await githubPutFileBase64(
      path,
      file.content,
      `Upload file for managed experience ${experienceName}: ${file.path}`,
      existing ? existing.sha : undefined
    );

    writtenFiles.push(path);
  }

  return writtenFiles;
}

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "MaraSense Experience Manager",
    version: "3.1.0",
    githubRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH
  });
});

app.post("/createManagedExperience", async (req, res) => {
  try {
    requireGithubToken();

    const data = normalizeExperiencePayload(req.body || {});
    const validationError = validateExperience(data);

    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const folder = `managed-experiences/${data.sector}/${data.slug}/`;
    const publicUrl = `${BASE_URL}/${folder}`;
    const config = buildConfig(data, folder, publicUrl);
    const record = buildIndexRecord(config, folder, publicUrl);

    const htmlPath = `${folder}index.html`;
    const configPath = `${folder}config.json`;

    const templateHtml = await readTemplateHtml();
    const existingHtml = await githubGetFile(htmlPath);
    const existingConfig = await githubGetFile(configPath);

    await githubPutFileText(
      htmlPath,
      templateHtml,
      `Create managed experience HTML: ${data.name}`,
      existingHtml ? existingHtml.sha : undefined
    );

    await githubPutFileText(
      configPath,
      JSON.stringify(config, null, 2) + "\n",
      `Create managed experience config: ${data.name}`,
      existingConfig ? existingConfig.sha : undefined
    );

    const writtenFiles = await writeUploadedFiles(folder, data.files, data.name);
    const updatedIndex = await updateExperiencesIndex(record);

    return res.status(200).json({
      ok: true,
      message: "Esperienza creata/aggiornata su GitHub con file.",
      folder,
      publicUrl,
      config,
      record,
      writtenFiles,
      indexCount: updatedIndex.length
    });
  } catch (error) {
    console.error("Errore createManagedExperience:", {
      message: error.message,
      status: error.response && error.response.status,
      data: error.response && error.response.data
    });

    return res.status(error.statusCode || 500).json({
      ok: false,
      error: "Errore durante la scrittura su GitHub.",
      detail: error.response && error.response.data
        ? error.response.data.message || error.response.data
        : error.message
    });
  }
});

exports.api = onRequest(
  {
    region: "europe-west1",
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 300,
    memory: "1GiB"
  },
  app
);
