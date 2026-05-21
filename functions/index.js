require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const ALLOWED_ORIGINS = [
  "https://marasenseexperiences-ar.web.app",
  "https://marasenseexperiences-ar.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

const corsOptions = {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
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

const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>MaraSense Experience</title>

  <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>

  <style>
    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      position: fixed;
      inset: 0;
    }

    a-scene {
      width: 100vw !important;
      height: 100vh !important;
      background: transparent !important;
    }

    video {
      display: none;
    }

    #lensOverlay {
      position: fixed;
      inset: 0;
      z-index: 20;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.08);
    }

    .lensBox {
      width: min(72vw, 330px);
      aspect-ratio: 1 / 1;
      border-radius: 32px;
      position: relative;
    }

    .corner {
      position: absolute;
      width: 58px;
      height: 58px;
      border-color: rgba(255, 255, 255, 0.95);
      filter: drop-shadow(0 0 8px rgba(138, 43, 226, 0.85));
    }

    .corner.tl {
      top: 0;
      left: 0;
      border-top: 5px solid;
      border-left: 5px solid;
      border-radius: 28px 0 0 0;
    }

    .corner.tr {
      top: 0;
      right: 0;
      border-top: 5px solid;
      border-right: 5px solid;
      border-radius: 0 28px 0 0;
    }

    .corner.bl {
      bottom: 0;
      left: 0;
      border-bottom: 5px solid;
      border-left: 5px solid;
      border-radius: 0 0 0 28px;
    }

    .corner.br {
      bottom: 0;
      right: 0;
      border-bottom: 5px solid;
      border-right: 5px solid;
      border-radius: 0 0 28px 0;
    }

    .scanLine {
      position: absolute;
      left: 10%;
      right: 10%;
      height: 3px;
      top: 18%;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, #00eaff, #8a2be2, transparent);
      box-shadow: 0 0 18px rgba(0, 234, 255, 0.9);
      animation: scanMove 2.2s ease-in-out infinite;
    }

    @keyframes scanMove {
      0% { top: 18%; opacity: 0.4; }
      50% { top: 82%; opacity: 1; }
      100% { top: 18%; opacity: 0.4; }
    }

    #statusText {
      position: fixed;
      left: 50%;
      bottom: max(32px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 25;
      width: min(88vw, 420px);
      text-align: center;
      color: white;
      font-size: 15px;
      line-height: 1.4;
      padding: 12px 16px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(12px);
      box-shadow: 0 0 18px rgba(0, 0, 0, 0.28);
    }

    #startScreen {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      background:
        radial-gradient(circle at top left, rgba(138, 43, 226, 0.32), transparent 34%),
        radial-gradient(circle at bottom right, rgba(0, 234, 255, 0.24), transparent 34%),
        #050505;
      color: white;
      text-align: center;
      padding: 24px;
    }

    #startScreen img {
      width: 110px;
      height: 110px;
      object-fit: contain;
      margin-bottom: 22px;
      animation: rotateLogo 8s linear infinite;
    }

    @keyframes rotateLogo {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    #startScreen h1 {
      margin: 0 0 10px;
      font-size: 26px;
    }

    #startScreen p {
      margin: 0 0 24px;
      max-width: 420px;
      color: #d7d7d7;
      line-height: 1.5;
      font-size: 15px;
    }

    #startButton {
      border: none;
      border-radius: 999px;
      padding: 14px 26px;
      color: white;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(135deg, #8a2be2, #00bcd4);
      box-shadow: 0 0 24px rgba(138, 43, 226, 0.38);
    }

    #errorBox {
      display: none;
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 80;
      width: min(88vw, 520px);
      padding: 18px;
      background: rgba(0, 0, 0, 0.78);
      color: white;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      line-height: 1.5;
      text-align: center;
    }
  </style>
</head>

<body>
  <div id="startScreen">
    <img
      src="shared.jpg"
      onerror="this.src='https://ndaprove.newdigitalapp.it/docs/MARASENSELOGO.png'"
      alt="MaraSense"
    />

    <h1 id="experienceTitle">MaraSense Experience</h1>

    <p>
      Premi il pulsante e inquadra il target per avviare il contenuto in realtà aumentata.
    </p>

    <button id="startButton" onclick="startExperience()">
      Avvia esperienza
    </button>
  </div>

  <div id="lensOverlay">
    <div class="lensBox">
      <div class="corner tl"></div>
      <div class="corner tr"></div>
      <div class="corner bl"></div>
      <div class="corner br"></div>
      <div class="scanLine"></div>
    </div>
  </div>

  <div id="statusText">Inquadra il target</div>
  <div id="errorBox"></div>

  <a-scene
    id="arScene"
    mindar-image="imageTargetSrc: targets.mind; autoStart: false; filterMinCF: 0.0001; filterBeta: 0.001;"
    embedded
    color-space="sRGB"
    renderer="colorManagement: true; physicallyCorrectLights: false; alpha: true; antialias: true;"
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false"
    background="transparent: true"
  >
    <a-assets id="assetContainer"></a-assets>

    <a-camera
      position="0 0 0"
      look-controls="enabled: false"
      cursor="rayOrigin: mouse"
    ></a-camera>

    <a-entity id="targetsContainer"></a-entity>
  </a-scene>

  <script>
    const DEFAULT_CONFIG = {
      title: "MaraSense Experience",
      type: "ar-video",
      targetFile: "targets.mind",
      sharedImage: "shared.jpg",
      contentFile: "content-1.mp4",
      autoPlay: true,
      requireContentEnd: false,
      stopOnTargetLost: true,
      transparentBg: true,
      lensUi: true,
      multiTarget: false,
      contents: [
        {
          id: 0,
          label: "Contenuto 1",
          targetId: 0,
          file: "content-1.mp4"
        }
      ]
    };

    let config = { ...DEFAULT_CONFIG };
    let sceneEl = null;
    let contentPlaying = false;
    let currentMedia = null;
    let currentTargetVisible = null;
    let experienceStarted = false;

    function showError(message) {
      const box = document.getElementById("errorBox");
      box.innerHTML = message;
      box.style.display = "block";
    }

    function setStatus(text) {
      document.getElementById("statusText").textContent = text;
    }

    function showLens(show) {
      const lens = document.getElementById("lensOverlay");

      if (!config.lensUi) {
        lens.style.display = "none";
        return;
      }

      lens.style.display = show ? "flex" : "none";
    }

    function isVideo(fileName) {
      const lower = String(fileName || "").toLowerCase();
      return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
    }

    function isAudio(fileName) {
      const lower = String(fileName || "").toLowerCase();
      return lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a");
    }

    function isImage(fileName) {
      const lower = String(fileName || "").toLowerCase();
      return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
    }

    async function loadConfig() {
      try {
        const response = await fetch("config.json", { cache: "no-store" });

        if (response.ok) {
          const remoteConfig = await response.json();
          config = { ...DEFAULT_CONFIG, ...remoteConfig };
        }
      } catch (error) {
        console.warn("Config non trovato, uso valori default.", error);
      }

      document.getElementById("experienceTitle").textContent =
        config.title || DEFAULT_CONFIG.title;

      if (config.sharedImage) {
        document.querySelector("#startScreen img").src = config.sharedImage;
      }

      buildSceneFromConfig();
      showLens(true);
    }

    function buildSceneFromConfig() {
      const assetContainer = document.getElementById("assetContainer");
      const targetsContainer = document.getElementById("targetsContainer");

      assetContainer.innerHTML = "";
      targetsContainer.innerHTML = "";

      const contents = Array.isArray(config.contents) && config.contents.length > 0
        ? config.contents
        : [
            {
              id: 0,
              label: "Contenuto 1",
              targetId: 0,
              file: config.contentFile || "content-1.mp4"
            }
          ];

      contents.forEach((content) => {
        const file = content.file;
        const assetId = "assetContent" + content.id;

        if (isVideo(file)) {
          const video = document.createElement("video");
          video.setAttribute("id", assetId);
          video.setAttribute("src", file);
          video.setAttribute("preload", "auto");
          video.setAttribute("playsinline", "");
          video.setAttribute("webkit-playsinline", "");
          video.setAttribute("crossorigin", "anonymous");
          assetContainer.appendChild(video);
        }

        if (isImage(file)) {
          const img = document.createElement("img");
          img.setAttribute("id", assetId);
          img.setAttribute("src", file);
          img.setAttribute("crossorigin", "anonymous");
          assetContainer.appendChild(img);
        }
      });

      const targetIds = [...new Set(contents.map((content) => Number(content.targetId || 0)))];

      targetIds.forEach((targetId) => {
        const targetEntity = document.createElement("a-entity");
        targetEntity.setAttribute("id", "target" + targetId);
        targetEntity.setAttribute("mindar-image-target", "targetIndex: " + targetId);

        const linkedContents = contents.filter((content) => Number(content.targetId || 0) === targetId);

        linkedContents.forEach((content, index) => {
          const file = content.file;
          const assetId = "#assetContent" + content.id;

          if (isVideo(file)) {
            const plane = document.createElement("a-video");
            plane.setAttribute("id", "planeContent" + content.id);
            plane.setAttribute("src", assetId);
            plane.setAttribute("width", "1.15");
            plane.setAttribute("height", "0.65");
            plane.setAttribute("position", "0 0 " + (index * 0.01));
            plane.setAttribute("rotation", "0 0 0");
            plane.setAttribute("visible", "false");
            targetEntity.appendChild(plane);
          }

          if (isImage(file)) {
            const image = document.createElement("a-image");
            image.setAttribute("id", "planeContent" + content.id);
            image.setAttribute("src", assetId);
            image.setAttribute("width", "1.1");
            image.setAttribute("height", "0.75");
            image.setAttribute("position", "0 0 " + (index * 0.01));
            image.setAttribute("rotation", "0 0 0");
            image.setAttribute("visible", "false");
            targetEntity.appendChild(image);
          }
        });

        targetsContainer.appendChild(targetEntity);
      });
    }

    async function startExperience() {
      if (experienceStarted) return;

      experienceStarted = true;

      document.getElementById("startScreen").style.display = "none";
      sceneEl = document.querySelector("a-scene");

      try {
        await sceneEl.systems["mindar-image-system"].start();

        setStatus("Inquadra il target");
        showLens(true);

        setupTargetEvents();
      } catch (error) {
        console.error(error);
        showError("Non riesco ad avviare la fotocamera. Controlla i permessi del browser e ricarica la pagina.");
      }
    }

    function hideAllPlanes() {
      const planes = document.querySelectorAll("[id^='planeContent']");
      planes.forEach((plane) => {
        plane.setAttribute("visible", "false");
      });
    }

    function stopCurrentMedia() {
      if (currentMedia) {
        try {
          currentMedia.pause();
          currentMedia.currentTime = 0;
        } catch (error) {}
      }

      currentMedia = null;
      contentPlaying = false;
      hideAllPlanes();
    }

    function playContentForTarget(targetId) {
      const contents = Array.isArray(config.contents) && config.contents.length > 0
        ? config.contents
        : [
            {
              id: 0,
              label: "Contenuto 1",
              targetId: 0,
              file: config.contentFile || "content-1.mp4"
            }
          ];

      const content = contents.find((item) => Number(item.targetId || 0) === Number(targetId));

      if (!content) {
        setStatus("Target trovato, ma nessun contenuto collegato.");
        return;
      }

      if (contentPlaying && config.requireContentEnd) {
        return;
      }

      stopCurrentMedia();

      const file = content.file;
      const plane = document.getElementById("planeContent" + content.id);

      contentPlaying = true;
      currentTargetVisible = targetId;

      setStatus("Target trovato");
      showLens(false);

      if (plane) {
        plane.setAttribute("visible", "true");
      }

      if (isVideo(file)) {
        const media = document.getElementById("assetContent" + content.id);

        currentMedia = media;

        try {
          media.currentTime = 0;
        } catch (error) {}

        media.play()
          .then(() => {
            setStatus("Contenuto in riproduzione");
          })
          .catch((error) => {
            console.warn("Autoplay video bloccato:", error);
            setStatus("Tocca lo schermo per avviare il contenuto");
          });

        media.onended = () => {
          contentPlaying = false;
          currentMedia = null;
          hideAllPlanes();

          setStatus("Contenuto terminato. Cerca un altro target.");
          showLens(true);
        };

        return;
      }

      if (isAudio(file)) {
        const audio = new Audio(file);
        currentMedia = audio;

        audio.play()
          .then(() => {
            setStatus("Audio in riproduzione");
          })
          .catch((error) => {
            console.warn("Autoplay audio bloccato:", error);
            setStatus("Tocca lo schermo per avviare l'audio");
          });

        audio.onended = () => {
          contentPlaying = false;
          currentMedia = null;

          setStatus("Audio terminato. Cerca un altro target.");
          showLens(true);
        };

        return;
      }

      if (isImage(file)) {
        contentPlaying = false;
        setStatus("Immagine visualizzata");
      }
    }

    function setupTargetEvents() {
      const contents = Array.isArray(config.contents) && config.contents.length > 0
        ? config.contents
        : [
            {
              id: 0,
              targetId: 0,
              file: config.contentFile || "content-1.mp4"
            }
          ];

      const targetIds = [...new Set(contents.map((content) => Number(content.targetId || 0)))];

      targetIds.forEach((targetId) => {
        const targetEntity = document.getElementById("target" + targetId);

        if (!targetEntity) return;

        targetEntity.addEventListener("targetFound", () => {
          currentTargetVisible = targetId;

          if (!config.autoPlay) {
            setStatus("Target trovato. Tocca per avviare.");
            showLens(false);
            return;
          }

          playContentForTarget(targetId);
        });

        targetEntity.addEventListener("targetLost", () => {
          if (config.requireContentEnd && contentPlaying) {
            setStatus("Contenuto in riproduzione");
            return;
          }

          if (config.stopOnTargetLost) {
            stopCurrentMedia();
            setStatus("Target perso. Cerca di nuovo.");
            showLens(true);
            return;
          }

          setStatus("Target perso. Il contenuto continua.");
          showLens(true);
        });
      });

      document.body.addEventListener("click", () => {
        if (currentTargetVisible !== null && !contentPlaying) {
          playContentForTarget(currentTargetVisible);
        }
      });
    }

    window.addEventListener("load", async () => {
      await loadConfig();
    });
  </script>
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

async function githubGetFile(path) {
  try {
    const url = `${GITHUB_API_BASE}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;

    const response = await axios.get(url, {
      headers: githubHeaders(),
      params: {
        ref: GITHUB_BRANCH
      }
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
  const url = `${GITHUB_API_BASE}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`;

  const body = {
    message,
    content: cleanBase64Content(base64Content),
    branch: GITHUB_BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await axios.put(url, body, {
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
    return {
      value: fallbackValue,
      sha: null
    };
  }

  const decoded = decodeBase64(existing.content);

  return {
    value: JSON.parse(decoded),
    sha: existing.sha
  };
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

  const targetImages = Array.isArray(body.targetImages)
    ? body.targetImages
    : [];

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

  const files = Array.isArray(body.files)
    ? body.files
    : [];

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
  if (!data.name || typeof data.name !== "string") {
    return "Nome esperienza mancante.";
  }

  if (!data.slug || !isValidPathSegment(data.slug)) {
    return "Slug esperienza non valido.";
  }

  if (!ALLOWED_SECTORS.includes(data.sector)) {
    return "Settore non valido.";
  }

  if (!ALLOWED_TYPES.includes(data.type)) {
    return "Tipo esperienza non valido.";
  }

  if (!isValidPathSegment(data.targetFile)) {
    return "Nome file target non valido.";
  }

  if (!isValidPathSegment(data.sharedImage)) {
    return "Nome file shared non valido.";
  }

  if (!isValidPathSegment(data.contentFile)) {
    return "Nome file contenuto principale non valido.";
  }

  if (!Array.isArray(data.contents) || data.contents.length === 0) {
    return "Aggiungi almeno un contenuto.";
  }

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

  const content = JSON.stringify(list, null, 2) + "\n";

  await githubPutFileText(
    indexPath,
    content,
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
    version: "3.0.0",
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
      return res.status(400).json({
        ok: false,
        error: validationError
      });
    }

    const folder = `managed-experiences/${data.sector}/${data.slug}/`;
    const publicUrl = `${BASE_URL}/${folder}`;

    const config = buildConfig(data, folder, publicUrl);
    const record = buildIndexRecord(config, folder, publicUrl);

    const htmlPath = `${folder}index.html`;
    const configPath = `${folder}config.json`;

    const existingHtml = await githubGetFile(htmlPath);
    const existingConfig = await githubGetFile(configPath);

    await githubPutFileText(
      htmlPath,
      TEMPLATE_HTML,
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

exports.api = onRequest(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB"
  },
  app
);