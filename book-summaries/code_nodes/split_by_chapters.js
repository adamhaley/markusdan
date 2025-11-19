let text = '';

try { text = $('PDF to Text').first().json.text || ''; } catch (e) {}
if (!text) {
  try { text = $('Extract Text').first().json.data || ''; } catch (e) {}
}
if (!text) {
  try { text = $('Extract Text1').first().json.data || ''; } catch (e) {}
}

if (!text && $json.text) text = $json.text;
if (!text && $json.data) text = $json.data;
if (!text) throw new Error('No text found.');

// 🧹 Normalize text
let cleaned = text
  .replace(/\r/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// 🧭 Skip front matter before first chapter
const prefaceMatch = cleaned.match(/(?:^|\n)(?:PART\s+1|CHAPTER\s+1|Chapter\s+1|1\s+\w+)/);
if (prefaceMatch && prefaceMatch.index > 1000) {
  cleaned = cleaned.slice(prefaceMatch.index);
}

// 🧠 Combined chapter detection
const chapterRegex = new RegExp(
  [
    '(^|\\n)\\s*(?:',
    '(?:CHAPTER|Chapter)\\s+[0-9IVXLCDM]+',
    '|(?:PART|Part)\\s+[0-9IVXLCDM]+',
    '|[0-9IVXLCDM]{1,3}[.\\s]+[A-Z]{3,}',
    ')'
  ].join(''),
  'g'
);

let starts = [];
let m;
while ((m = chapterRegex.exec(cleaned)) !== null) {
  starts.push(m.index + (m[1] ? m[1].length : 0));
}

// Fallback for MOBI edge case
if (starts.length === 0) {
  const guessRegex = /\n(?=[A-Z][A-Z\s]{6,}\n)/g;
  while ((m = guessRegex.exec(cleaned)) !== null) {
    starts.push(m.index);
  }
}

// ✂️ Slice clean chapter chunks
let parts = [];
for (let i = 0; i < starts.length; i++) {
  const start = starts[i];
  const end = starts[i + 1] || cleaned.length;
  const chunk = cleaned.slice(start, end).trim();

  if (chunk.split(/\s+/).length > 50) parts.push(chunk);
}

// 🧩 Structure output
return parts.map((chapter, i) => {
  const lines = chapter.split(/\n+/);
  
  // 🏷️ Find a concise title candidate (short, uppercase or titlecase)
  let titleLine = lines.find(l => l.trim().length && l.trim().split(/\s+/).length <= 10) || '';
  
  // Fallback: look at first non-empty line if not found
  if (!titleLine) titleLine = lines.find(l => l.trim().length) || '';
  
  const matchNum = titleLine.match(/([0-9IVXLCDM]+)/i);
  const detectedIndex = matchNum ? matchNum[1] : i + 1;

  // Remove the title line from content
  const titleIndex = lines.indexOf(titleLine);
  const content = lines.slice(titleIndex + 1).join('\n').trim();

  return {
    json: {
      chapter_index: detectedIndex,
      chapter_title: titleLine.replace(/\s{2,}/g, ' ').trim() || `Chapter ${i + 1}`,
      content,
      word_count: content.split(/\s+/).length
    }
  };
});
