import pg from "pg";

let pool;
let initialized;

const questionRules = {
  tasteDirection: { min: 1, max: 2 },
  dryness: { min: 1, max: 1 },
  aromas: { min: 1, max: 3 },
  mouthfeel: { min: 1, max: 1 },
  champagneStyle: { min: 1, max: 6 },
  occasion: { min: 1, max: 6 },
  budget: { min: 1, max: 1 },
  avoid: { min: 0, max: 7 }
};

function database() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("Cloud database is not configured");
  const sslDisabled = ["0", "false", "disable"].includes(
    String(process.env.DATABASE_SSL || "").trim().toLowerCase()
  );
  pool ||= new pg.Pool({
    connectionString: url,
    ssl: sslDisabled || url.includes("localhost") ? false : { rejectUnauthorized: false }
  });
  return pool;
}

async function ready() {
  const db = database();
  initialized ||= db.query(`
    CREATE TABLE IF NOT EXISTS user_taste_profiles (
      user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
      profile_version INTEGER NOT NULL DEFAULT 1,
      answers JSONB NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await initialized;
  return db;
}

export function cleanTasteAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid taste profile");
  }
  const answers = {};
  const suppliedValues = Object.values(value)
    .flatMap((raw) => Array.isArray(raw) ? raw : raw == null ? [] : [raw])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const skipped = suppliedValues.length === 0;
  for (const [key, rule] of Object.entries(questionRules)) {
    const raw = value[key];
    const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    const clean = [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
    if ((!skipped && clean.length < rule.min) || clean.length > rule.max || clean.some((item) => item.length > 80)) {
      throw new Error(`Invalid answer for ${key}`);
    }
    answers[key] = clean;
  }
  return answers;
}

function profileSummary(answers) {
  const parts = [
    answers.tasteDirection.join(" en ").toLowerCase(),
    answers.dryness[0]?.toLowerCase(),
    answers.champagneStyle.slice(0, 2).join(" en ").toLowerCase()
  ].filter(Boolean);
  return parts.length
    ? `Je voorkeur gaat uit naar ${parts.join(", ")}. Antoine verfijnt dit profiel met je bezoeken en feedback.`
    : "Je hebt de smaakvragen overgeslagen. Antoine leert je voorkeuren gaandeweg kennen via je gesprekken en bezoeken.";
}

export async function tasteProfile(userId) {
  const db = await ready();
  const result = await db.query(
    `SELECT profile_version, answers, summary, completed_at, updated_at
     FROM user_taste_profiles WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return row ? {
    version: row.profile_version,
    answers: row.answers,
    summary: row.summary,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  } : null;
}

export async function saveTasteProfile(userId, value) {
  const answers = cleanTasteAnswers(value);
  const summary = profileSummary(answers);
  const db = await ready();
  const result = await db.query(
    `INSERT INTO user_taste_profiles
       (user_id, profile_version, answers, summary, completed_at, updated_at)
     VALUES ($1, 1, $2::jsonb, $3, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       profile_version = EXCLUDED.profile_version,
       answers = EXCLUDED.answers,
       summary = EXCLUDED.summary,
       updated_at = NOW()
     RETURNING profile_version, answers, summary, completed_at, updated_at`,
    [userId, JSON.stringify(answers), summary]
  );
  const row = result.rows[0];
  return {
    version: row.profile_version,
    answers: row.answers,
    summary: row.summary,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

function outputText(response) {
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export async function askAntoine({ user, message, history = [], profile, producers = [], visited = [] }) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("Chef de Cave AI is not configured");
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage || cleanMessage.length > 1200) throw new Error("Invalid message");
  const cleanHistory = (Array.isArray(history) ? history : []).slice(-10).flatMap((entry) => {
    const role = entry?.role === "assistant" ? "assistant" : "user";
    const content = String(entry?.content || "").trim().slice(0, 1600);
    return content ? [{ role, content }] : [];
  });
  const catalog = producers.slice(0, 350).map((producer) => ({
    id: producer.id,
    name: producer.name,
    city: producer.city,
    region: producer.region,
    cru: producer.cruLabel || "",
    visitable: Boolean(producer.visitable),
    tastings: Boolean(producer.tastings),
    bookingUrl: producer.bookingUrl || ""
  }));
  const instructions = `Je bent Antoine, de warme, deskundige Chef de Cave van Champagne Atlas.
Antwoord in natuurlijk Nederlands, tenzij de gebruiker een andere taal gebruikt.
Geef persoonlijk advies op basis van het smaakprofiel, bezochte huizen en uitsluitend de meegegeven catalogus.
Leg altijd kort uit waarom een advies past. Verzin geen huizen, openingstijden, prijzen of bezoekmogelijkheden.
Praktische gegevens zijn mogelijk gewijzigd: adviseer controle via officiële website of reserveringspagina.
Noem bij aanbevelingen maximaal drie huizen en schrijf compact, elegant en behulpzaam.
Gebruiker: ${user.name || user.email}
Smaakprofiel: ${JSON.stringify(profile)}
Bezochte huis-ID's: ${JSON.stringify(visited)}
Beschikbare catalogus: ${JSON.stringify(catalog)}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: String(process.env.OPENAI_MODEL || "gpt-5.6-sol"),
      instructions,
      input: [...cleanHistory, { role: "user", content: cleanMessage }],
      max_output_tokens: 700
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const body = await response.json();
  const answer = outputText(body);
  if (!answer) throw new Error("OpenAI returned no answer");
  return { answer };
}
