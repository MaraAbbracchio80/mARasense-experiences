require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}

const ALLOWED_ORIGINS = [
  "https://marasenseexperiences-ar.web.app",
  "https://marasenseexperiences-ar.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-goog-meta-firebasestoragedownloadtokens");
  if (req.method === "OPTIONS") return res.status(204).send("");
  return next();
});

app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "x-goog-meta-firebasestoragedownloadtokens"] }));
app.use(express.json({ limit: "5mb" }));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "MaraAbbracchio80";
const GITHUB_REPO = process.env.GITHUB_REPO || "mARasense-experiences";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "marasenseexperiences-ar.firebasestorage.app";

const BASE_URL = "https://marasenseexperiences-ar.web.app";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

const ALLOWED_SECTORS = ["food", "painting", "sport", "eventi", "matrimoni", "museo", "retail", "custom"];
const ALLOWED_TYPES = ["ar-video", "ar-audio", "ar-video-audio", "multi-target"];
const FALLBACK_TEMPLATE_HTML = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MaraSense Experience</title></head><body><h1>MaraSense Experience</h1><p>Template AR non trovato.</p></body></html>`;

function requireGithubToken() {
  if (!GITHUB_TOKEN) {
    const error = new Error("GITHUB_TOKEN mancante nel file .env.");
    error.statusCode = 500;
    throw error;
  }
}

function githubHeaders() {
  requireGithubToken();
  return { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

function slugify(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function isValidPathSegment(value) {
  if (!value || typeof value !== "string") return false;
  if (value.includes("..") || value.includes("/") || value.includes("\\")) return false;
  return /^[a-z0-9._-]+$/i.test(value);
}

function isValidAssetReference(value) {
  if (!value || typeof value !== "string") return false;
  if (isValidPathSegment(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

function encodeTextBase64(text) { return Buffer.from(text, "utf8").toString("base64"); }
function decodeBase64(content) { return Buffer.from(content || "", "base64").toString("utf8"); }
function cleanBase64Content(value) { return String(value || "").replace(/^data:.*?;base64,/, "").replace(/\s/g, ""); }
function githubPathUrl(path) { return `${GITHUB_API_BASE}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`; }

async function githubGetFile(path) {
  try {
    const response = await axios.get(githubPathUrl(path), { headers: githubHeaders(), params: { ref: GITHUB_BRANCH } });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    throw error;
  }
}

async function githubPutFileBase64(path, base64Content, message, sha) {
  const body = { message, content: cleanBase64Content(base64Content), branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const response = await axios.put(githubPathUrl(path), body, { headers: githubHeaders() });
  return response.data;
}

async function githubPutFileText(path, content, message, sha) {
  return githubPutFileBase64(path, encodeTextBase64(content), message, sha);
}

async function readJsonFile(path, fallbackValue) {
  const existing = await githubGetFile(path);
  if (!existing) return { value: fallbackValue, sha: null };
  return { value: JSON.parse(decodeBase64(existing.content)), sha: existing.sha };
}

async function readTemplateHtml() {
  const templateFile = await githubGetFile("managed-experiences/_template/index.html");
  if (!templateFile || !templateFile.content) return FALLBACK_TEMPLATE_HTML;
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
  const contents = Array.isArray(body.contents) && body.contents.length > 0 ? body.contents : [{ id: 0, label: "Contenuto 1", targetId: 0, file: contentFile, kind: "video" }];
  const files = Array.isArray(body.files) ? body.files : [];
  return { sector, type, name, notes, slug, targetFile, sharedImage, contentFile, options, targetImages, contents, files };
}

function validateExperience(data) {
  if (!data.name || typeof data.name !== "string") return "Nome esperienza mancante.";
  if (!data.slug || !isValidPathSegment(data.slug)) return "Slug esperienza non valido.";
  if (!ALLOWED_SECTORS.includes(data.sector)) return "Settore non valido.";
  if (!ALLOWED_TYPES.includes(data.type)) return "Tipo esperienza non valido.";
  if (!isValidAssetReference(data.targetFile)) return "File target non valido.";
  if (!isValidAssetReference(data.sharedImage)) return "File shared non valido.";
  if (!isValidAssetReference(data.contentFile)) return "File contenuto principale non valido.";
  if (!Array.isArray(data.contents) || data.contents.length === 0) return "Aggiungi almeno un contenuto.";
  for (const content of data.contents) if (!isValidAssetReference(content.file)) return `File contenuto non valido: ${content.file}`;
  for (const target of data.targetImages) if (target.file && target.file !== "-" && !isValidAssetReference(target.file)) return `File immagine target non valido: ${target.file}`;
  return "";
}

function buildConfig(data, folder, publicUrl) {
  const firstContent = data.contents[0] || { file: data.contentFile, targetId: 0, kind: "video" };
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
    multiTarget: data.type === "multi-target" || data.contents.length > 1 || data.targetImages.length > 1,
    targetImages: data.targetImages.map((target, index) => ({ id: Number.isInteger(target.id) ? target.id : index, label: target.label || `Target ${index + 1}`, file: target.file || "-", originalFile: target.originalFile || "-" })),
    contents: data.contents.map((content, index) => ({ id: Number.isInteger(content.id) ? content.id : index, label: content.label || `Contenuto ${index + 1}`, targetId: Number.isInteger(content.targetId) ? content.targetId : 0, file: content.file, kind: content.kind || "video", originalFile: content.originalFile || "-" })),
    targets: data.contents.map((content, index) => ({ id: Number.isInteger(content.targetId) ? content.targetId : 0, content: content.file, kind: content.kind || "video", label: content.label || `Contenuto ${index + 1}` })),
    meta: { slug: data.slug, notes: data.notes, generatedFolder: folder, publicUrl, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  };
}

function buildIndexRecord(config, folder, publicUrl) {
  return { id: `${config.sector}/${config.meta.slug}`, name: config.title, title: config.title, sector: config.sector, type: config.type, slug: config.meta.slug, createdAt: config.meta.createdAt, updatedAt: config.meta.updatedAt, folder, publicUrl, sharedImage: config.sharedImage, targetFile: config.targetFile, contentFile: config.contentFile, targetImages: config.targetImages || [], contents: config.contents || [], targets: config.targets || [] };
}

async function updateExperiencesIndex(record) {
  const indexPath = "managed-experiences/index.json";
  const { value, sha } = await readJsonFile(indexPath, []);
  const list = Array.isArray(value) ? value : [];
  const existingIndex = list.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    const previous = list[existingIndex];
    list[existingIndex] = { ...previous, ...record, createdAt: previous.createdAt || record.createdAt, updatedAt: record.updatedAt };
  } else {
    list.push(record);
  }
  await githubPutFileText(indexPath, JSON.stringify(list, null, 2) + "\n", `Update managed experiences index: ${record.name}`, sha);
  return list;
}

async function writeUploadedFiles(folder, files, experienceName) {
  const writtenFiles = [];
  for (const file of files) {
    if (!file || !isValidPathSegment(file.path) || !file.content) continue;
    const path = `${folder}${file.path}`;
    const existing = await githubGetFile(path);
    await githubPutFileBase64(path, file.content, `Upload file for managed experience ${experienceName}: ${file.path}`, existing ? existing.sha : undefined);
    writtenFiles.push(path);
  }
  return writtenFiles;
}

function storageDownloadUrl(objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "MaraSense Experience Manager", version: "4.1.0-storage-upload", githubRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`, branch: GITHUB_BRANCH, storageBucket: STORAGE_BUCKET });
});

app.post("/getUploadUrl", async (req, res) => {
  try {
    const rawPath = String(req.body && req.body.path ? req.body.path : "");
    const contentType = String(req.body && req.body.contentType ? req.body.contentType : "application/octet-stream");

    if (!rawPath || rawPath.includes("..") || rawPath.startsWith("/") || rawPath.includes("\\")) {
      return res.status(400).json({ ok: false, error: "Percorso file non valido." });
    }

    const token = crypto.randomUUID();
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    const file = bucket.file(rawPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
      extensionHeaders: {
        "x-goog-meta-firebasestoragedownloadtokens": token
      }
    });

    return res.status(200).json({ ok: true, uploadUrl, downloadUrl: storageDownloadUrl(rawPath, token), token, path: rawPath });
  } catch (error) {
    console.error("Errore getUploadUrl:", error);
    return res.status(500).json({ ok: false, error: "Errore creazione URL upload.", detail: error.message });
  }
});

app.post("/createManagedExperience", async (req, res) => {
  try {
    requireGithubToken();
    const data = normalizeExperiencePayload(req.body || {});
    const validationError = validateExperience(data);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const folder = `managed-experiences/${data.sector}/${data.slug}/`;
    const publicUrl = `${BASE_URL}/${folder}`;
    const config = buildConfig(data, folder, publicUrl);
    const record = buildIndexRecord(config, folder, publicUrl);
    const templateHtml = await readTemplateHtml();

    const htmlPath = `${folder}index.html`;
    const configPath = `${folder}config.json`;
    const existingHtml = await githubGetFile(htmlPath);
    const existingConfig = await githubGetFile(configPath);

    await githubPutFileText(htmlPath, templateHtml, `Create managed experience HTML: ${data.name}`, existingHtml ? existingHtml.sha : undefined);
    await githubPutFileText(configPath, JSON.stringify(config, null, 2) + "\n", `Create managed experience config: ${data.name}`, existingConfig ? existingConfig.sha : undefined);
    const writtenFiles = await writeUploadedFiles(folder, data.files, data.name);
    const updatedIndex = await updateExperiencesIndex(record);

    return res.status(200).json({ ok: true, message: "Esperienza creata/aggiornata su GitHub.", folder, publicUrl, config, record, writtenFiles, indexCount: updatedIndex.length });
  } catch (error) {
    console.error("Errore createManagedExperience:", { message: error.message, status: error.response && error.response.status, data: error.response && error.response.data });
    return res.status(error.statusCode || 500).json({ ok: false, error: "Errore durante la scrittura su GitHub.", detail: error.response && error.response.data ? error.response.data.message || error.response.data : error.message });
  }
});

exports.api = onRequest({ region: "europe-west1", cors: ALLOWED_ORIGINS, timeoutSeconds: 300, memory: "1GiB" }, app);
