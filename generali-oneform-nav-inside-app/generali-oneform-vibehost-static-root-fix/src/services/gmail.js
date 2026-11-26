const { google } = require("googleapis");
const crypto = require("node:crypto");

const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
  "GOOGLE_REFRESH_TOKEN", "GOOGLE_SHARED_MAILBOX"];

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function createGoogleOAuthClient() {
  const oauth = new google.auth.OAuth2(
    env("GOOGLE_CLIENT_ID"),
    env("GOOGLE_CLIENT_SECRET"),
    env("GOOGLE_REDIRECT_URI")
  );
  oauth.setCredentials({ refresh_token: env("GOOGLE_REFRESH_TOKEN") });
  return oauth;
}

function googleAuthorizationUrl(state) {
  const oauth = new google.auth.OAuth2(
    env("GOOGLE_CLIENT_ID"), env("GOOGLE_CLIENT_SECRET"), env("GOOGLE_REDIRECT_URI")
  );
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
    state
  });
}

async function exchangeGoogleCode(code) {
  const oauth = new google.auth.OAuth2(
    env("GOOGLE_CLIENT_ID"), env("GOOGLE_CLIENT_SECRET"), env("GOOGLE_REDIRECT_URI")
  );
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke the app grant and authorize again with consent.");
  }
  return tokens;
}

function encodeHeader(value) {
  return String(value).replace(/[\r\n]/g, " ").trim();
}
function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function safeFilename(name) {
  const cleaned = String(name || "attachment.bin").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return cleaned || "attachment.bin";
}

async function sendHqEmail({ to, subject, text, attachments, reference }) {
  const sender = env("GOOGLE_SHARED_MAILBOX");
  const allowed = (process.env.HQ_ALLOWED_RECIPIENTS || env("GOOGLE_HQ_RECIPIENT"))
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const recipients = String(to || env("GOOGLE_HQ_RECIPIENT")).split(",").map(x => x.trim());
  if (!recipients.length || recipients.some(x => !allowed.includes(x.toLowerCase()))) {
    throw new Error("Recipient is not in the configured HQ allow-list.");
  }
  if (!Array.isArray(attachments) || attachments.length < 1 || attachments.length > 12) {
    throw new Error("Expected 1 to 12 approved attachments.");
  }

  const boundary = `oneform_${crypto.randomBytes(18).toString("hex")}`;
  const lines = [
    `From: ${encodeHeader(sender)}`,
    `To: ${recipients.map(encodeHeader).join(", ")}`,
    `Subject: ${encodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    "",
    String(text || `Generali OneForm submission ${reference || ""}`),
    ""
  ];

  for (const file of attachments) {
    if (!Buffer.isBuffer(file.buffer)) throw new Error("Attachment content must be a Buffer from private storage.");
    if (file.buffer.length > 18 * 1024 * 1024) throw new Error("An attachment exceeds the 18 MB per-file safety limit.");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${file.mimeType || "application/octet-stream"}; name="${safeFilename(file.filename)}"`,
      `Content-Disposition: attachment; filename="${safeFilename(file.filename)}"`,
      "Content-Transfer-Encoding: base64",
      "",
      file.buffer.toString("base64").replace(/.{1,76}/g, "$&\r\n"),
      ""
    );
  }
  lines.push(`--${boundary}--`, "");
  const raw = base64Url(lines.join("\r\n"));
  const gmail = google.gmail({ version: "v1", auth: createGoogleOAuthClient() });
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw }
  });
  return {
    provider: "gmail",
    messageId: response.data.id || null,
    threadId: response.data.threadId || null,
    sender,
    recipients
  };
}

module.exports = { createGoogleOAuthClient, googleAuthorizationUrl, exchangeGoogleCode, sendHqEmail };
