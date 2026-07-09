// Get email text
const text = $json.text || $input.first().json.test_email || "";

// --------------------------------------
// Extract first / last name
// Supports both German and English labels
// --------------------------------------
const firstMatch = text.match(/(?:Vorname|First name):\s*([^<\n\r]*)/i);
const lastMatch = text.match(/(?:Nachname|Last name):\s*([^<\n\r]*)/i);

const firstname = firstMatch ? firstMatch[1].trim() : "";

let lastname = "";
if (lastMatch && lastMatch[1]) {
  const rawLast = lastMatch[1].trim();

  // Avoid accidentally grabbing the next field if lastname is blank
  if (!/^(E-Mail|Email|Phone|Telefon|Callback|Note|Hinweis)/i.test(rawLast)) {
    lastname = rawLast;
  }
}

// Build fullname
let fullname = firstname;
if (lastname) {
  fullname = `${firstname} ${lastname}`;
}

// --------------------------------------
// Extract attendee email address
// Supports:
// Email:
// E-Mail:
// mailto:
// plain email fallback
// --------------------------------------
let replyTo = null;

// 1. Prefer labeled Email / E-Mail field
let emailMatch = text.match(
  /(?:E-Mail|Email):\s*(?:<a[^>]*href=["']mailto:)?([^\s<>"']+@[^\s<>"']+)/i
);

// 2. Fallback: any mailto link
if (!emailMatch) {
  emailMatch = text.match(/mailto:([^\s<>"']+@[^\s<>"']+)/i);
}

// 3. Last fallback: any email address in the body
if (!emailMatch) {
  emailMatch = text.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
}

if (emailMatch) {
  replyTo = emailMatch[1]
    .trim()
    .replace(/[.,;]+$/, "")
    .toLowerCase();
}

// --------------------------------------
// Extract "Chat:" section only
// --------------------------------------
const chatSectionRaw = text.split(/Chat:/i)[1] || "";

// --------------------------------------
// Normalize chat section before parsing
// HTML emails often use <br> instead of line breaks.
// --------------------------------------
let chatSection = chatSectionRaw
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/p>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/\r/g, "")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{2,}/g, "\n")
  .trim();

// Webinar notification emails often append signoff/footer text directly
// after the chat block. Truncate at the first obvious footer marker so the
// last question does not absorb "Viele Grüße", "Webinaris", "Hinweis:", etc.
chatSection = chatSection.split(
  /\n(?=(?:Von|From|An|To|Datum|Date):|Viele Grüße,?|Webinaris\s*\(|Hinweis:|Wenn du keine Benachrichtigungs-Mails)/i
)[0].trim();

// --------------------------------------
// Parse questions
// Keeps the same output contract as the current node
// --------------------------------------
const questions = [];

function isRealQuestion(q) {
  const text = q.trim();

  if (!text) {
    return false;
  }

  // Reject emoji-only or symbol-only messages like "👍🏻"
  if (/^[\p{Emoji}\p{Symbol}\s]+$/u.test(text)) {
    return false;
  }

  // Reject short acknowledgements and feedback that are not actionable questions
  if (/^(ja|nein|ok|okay|danke|danke schön|dankeschön|super|perfekt|top|gut)$/i.test(text)) {
    return false;
  }

  // A question mark is the clearest signal that this should pass through
  if (text.includes("?")) {
    return true;
  }

  // Reject very short fragments even if they are not in the explicit stoplist
  if (text.length < 12) {
    return false;
  }

  // Keep longer sentence-like inputs for now, even if they omit '?'
  return /\s/.test(text);
}

// Split on numbered chat entries like:
// 1: Tatjana (10/09/2025 10:58): Question text...
const parts = chatSection.split(/\n(?=\d+:\s.*?\):\s*)/);

for (const part of parts) {
  const match = part.match(/^\d+:\s.*?\):\s*([\s\S]*)$/);
  if (!match) {
    continue;
  }

  let q = match[1].replace(/\s+/g, " ").trim();

  // Skip clear footer/signoff lines but do not stop parsing entirely.
  if (!q) {
    continue;
  }

  if (/^(Vielen Dank|Thank you in advance|Best regards|Kind regards|Hinweis:|Note:)/i.test(q)) {
    continue;
  }

  if (isRealQuestion(q)) {
    questions.push({ question: q });
  }
}

// --------------------------------------
// Return data
// IMPORTANT: keeps top-level "questions"
// --------------------------------------
return {
  threadId: $input.first().json.threadId || "none",
  replyTo: replyTo || "not_found@example.com",
  replyToName: {
    fullname,
    firstname,
    lastname
  },
  questions: questions.map(q => ({ json: q }))
};
