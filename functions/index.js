const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

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

const BASE_URL = "https://marasenseexperiences-ar.web.app";

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidFileName(name) {
  if (!name) return false;
  if (typeof name !== "string") return false;
  if (name.includes("..")) return false;
  if (name.includes("/")) return false;
  if (name.includes("\\")) return false;
  return true;
}

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "MaraSense Experience Manager",
    version: "1.0.0"
  });
});

app.post("/createManagedExperience", async (req, res) => {
  try {
    const body = req.body || {};

    const sector = body.sector;
    const type = body.type;
    const name = body.name;
    const notes = body.notes || "";

    const slug = slugify(body.slug || name);

    const targetFile = body.targetFile || "targets.mind";
    const sharedImage = body.sharedImage || "shared.jpg";
    const contentFile = body.contentFile || "content.mp4";

    const options = body.options || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Nome esperienza mancante."
      });
    }

    if (!slug) {
      return res.status(400).json({
        ok: false,
        error: "Slug non valido."
      });
    }

    if (!ALLOWED_SECTORS.includes(sector)) {
      return res.status(400).json({
        ok: false,
        error: "Settore non valido."
      });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        ok: false,
        error: "Tipo esperienza non valido."
      });
    }

    if (!isValidFileName(targetFile)) {
      return res.status(400).json({
        ok: false,
        error: "Nome file target non valido."
      });
    }

    if (!isValidFileName(sharedImage)) {
      return res.status(400).json({
        ok: false,
        error: "Nome file shared non valido."
      });
    }

    if (!isValidFileName(contentFile)) {
      return res.status(400).json({
        ok: false,
        error: "Nome file contenuto non valido."
      });
    }

    const folder = `managed-experiences/${sector}/${slug}/`;
    const publicUrl = `${BASE_URL}/${folder}`;

    const config = {
      title: name,
      type,
      sector,

      targetFile,
      sharedImage,
      contentFile,

      autoPlay: options.autoPlay !== false,
      requireContentEnd: options.requireContentEnd === true,
      stopOnTargetLost: options.stopOnTargetLost !== false,
      transparentBg: options.transparentBg !== false,
      lensUi: options.lensUi !== false,

      multiTarget: type === "multi-target",

      targets: [
        {
          id: 0,
          content: contentFile
        }
      ],

      meta: {
        slug,
        notes,
        generatedFolder: folder,
        publicUrl,
        createdAt: new Date().toISOString()
      }
    };

    return res.status(200).json({
      ok: true,
      message: "Pacchetto esperienza validato. Nel prossimo step verrà scritto su GitHub.",
      folder,
      publicUrl,
      config
    });

  } catch (error) {
    console.error("Errore createManagedExperience:", error);

    return res.status(500).json({
      ok: false,
      error: "Errore interno durante la creazione esperienza."
    });
  }
});

exports.api = functions
  .region("europe-west1")
  .https
  .onRequest(app);