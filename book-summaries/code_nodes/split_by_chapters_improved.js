// ============================================
// ENHANCED CHAPTER SPLITTER FOR N8N
// Handles 7+ chapter format variations
// ============================================

// 📥 Get text from various input sources
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

// 📍 Find chapter candidate positions with metadata
function findChapterCandidates(text) {
  const candidates = [];
  const lines = text.split('\n');

  // Special section keywords (intro, conclusion, etc.)
  const specialSections = /^(INTRODUCTION|PREFACE|PROLOGUE|EPILOGUE|CONCLUSION|FOREWORD|AFTERWORD|ACKNOWLEDGMENTS?|APPENDIX)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    const prevLine = i > 0 ? lines[i - 1].trim() : '';

    // Skip if line is too long (likely content, not a chapter marker)
    if (trimmed.length > 100) continue;

    let match = null;
    let type = null;
    let confidence = 0;

    // Pattern 1: "CHAPTER X" or "Chapter X"
    if (match = trimmed.match(/^(CHAPTER|Chapter)\s+([0-9IVXLCDM]+)(\s|:|$)/)) {
      type = 'chapter_word';
      confidence = 95;
    }
    // Pattern 2: "PART X" or "Part X"
    else if (match = trimmed.match(/^(PART|Part)\s+([0-9IVXLCDM]+)(\s|:|$)/)) {
      type = 'part_word';
      confidence = 95;
    }
    // Pattern 3: Standalone number on its own line (with uppercase title on next line)
    else if (match = trimmed.match(/^([0-9]{1,2}|[IVXLCDM]{1,5})$/)) {
      // Validate: next line should be uppercase title, prev line should be blank
      if (nextLine && nextLine.length > 0 &&
          nextLine === nextLine.toUpperCase() &&
          nextLine.match(/[A-Z]{3,}/) &&
          prevLine.length === 0) {
        type = 'standalone_number';
        confidence = 85;
      }
    }
    // Pattern 4: "X. TITLE" (number dot space title)
    else if (match = trimmed.match(/^([0-9]{1,2}|[IVXLCDM]{1,5})\.\s+([A-Z][A-Z\s]{2,})/)) {
      // Higher confidence if surrounded by blank lines
      type = 'number_dot_title';
      confidence = prevLine.length === 0 && nextLine.length === 0 ? 80 : 65;
    }
    // Pattern 5: Special sections (INTRODUCTION, PREFACE, etc.)
    else if (match = trimmed.match(specialSections)) {
      type = 'special_section';
      confidence = 90;
    }
    // Pattern 6: "Chapter X:" followed by title on same line
    else if (match = trimmed.match(/^(CHAPTER|Chapter)\s+([0-9IVXLCDM]+):\s+(.+)/i)) {
      type = 'chapter_with_title';
      confidence = 85;
    }

    // If we found a match, validate context
    if (match && confidence > 0) {
      // Boost confidence if surrounded by blank lines
      if (prevLine.length === 0 && nextLine.length === 0) {
        confidence += 5;
      }

      // Reduce confidence if inside a sentence or list
      if (prevLine.length > 0 && !prevLine.match(/^(CHAPTER|Chapter|PART|Part)/)) {
        const prevWords = prevLine.split(/\s+/).length;
        if (prevWords > 5 && !prevLine.match(/[.!?]$/)) {
          confidence -= 20; // Likely mid-paragraph
        }
      }

      // Calculate position in text
      const charPosition = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);

      candidates.push({
        lineIndex: i,
        charPosition: charPosition,
        line: trimmed,
        type: type,
        confidence: confidence,
        match: match
      });
    }
  }

  return candidates;
}

// 🔍 Find all chapter candidates
let candidates = findChapterCandidates(cleaned);

// 🎯 Filter and sort by confidence
candidates = candidates.filter(c => c.confidence >= 65);
candidates.sort((a, b) => a.charPosition - b.charPosition);

// 🧭 Smart front matter removal
// Remove everything before the first high-confidence chapter marker
if (candidates.length > 0) {
  // Look for first real chapter (not special sections at the beginning)
  let firstChapterIndex = candidates.findIndex(c =>
    (c.type === 'chapter_word' || c.type === 'standalone_number' || c.type === 'number_dot_title') &&
    c.charPosition > 500 // Must be past copyright/title page
  );

  // If no regular chapters found, use first special section after 500 chars
  if (firstChapterIndex === -1) {
    firstChapterIndex = candidates.findIndex(c => c.charPosition > 500);
  }

  // If we found a good starting point, trim everything before it
  if (firstChapterIndex !== -1 && candidates[firstChapterIndex].charPosition > 1000) {
    cleaned = cleaned.slice(candidates[firstChapterIndex].charPosition);
    // Re-find candidates in trimmed text
    candidates = findChapterCandidates(cleaned);
    candidates = candidates.filter(c => c.confidence >= 65);
    candidates.sort((a, b) => a.charPosition - b.charPosition);
  }
}

// 🔄 Fallback: If no chapters found, try aggressive pattern matching
if (candidates.length === 0) {
  const lines = cleaned.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

    // Look for lines that are: uppercase, short (3-50 chars), surrounded by blanks
    if (line.length >= 3 && line.length <= 50 &&
        line === line.toUpperCase() &&
        line.match(/[A-Z]{3,}/) &&
        prevLine.length === 0 &&
        nextLine.length === 0) {

      const charPosition = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      candidates.push({
        lineIndex: i,
        charPosition: charPosition,
        line: line,
        type: 'uppercase_title',
        confidence: 50,
        match: [line]
      });
    }
  }
  candidates.sort((a, b) => a.charPosition - b.charPosition);
}

// ✂️ Split text into chapters based on candidates
let chapters = [];
for (let i = 0; i < candidates.length; i++) {
  const start = candidates[i].charPosition;
  const end = i < candidates.length - 1 ? candidates[i + 1].charPosition : cleaned.length;
  const chunk = cleaned.slice(start, end).trim();

  // Only include if substantial content (>50 words)
  const wordCount = chunk.split(/\s+/).length;
  if (wordCount > 50) {
    chapters.push({
      text: chunk,
      candidate: candidates[i],
      wordCount: wordCount
    });
  }
}

// 🧩 Structure output for n8n
return chapters.map((chapter, i) => {
  const lines = chapter.text.split(/\n+/);

  // 🏷️ Extract title (first 1-3 lines typically)
  let titleLines = [];
  let contentStartIndex = 1;

  // For standalone numbers, title is on second line
  if (chapter.candidate.type === 'standalone_number') {
    titleLines.push(lines[0]); // The number
    if (lines[1]) titleLines.push(lines[1]); // The title
    contentStartIndex = 2;
  }
  // For other formats, title is typically first line
  else {
    titleLines.push(lines[0]);
    // If second line looks like a subtitle (not too long), include it
    if (lines[1] && lines[1].length < 100 && lines[1].length > 0) {
      const words = lines[1].split(/\s+/).length;
      if (words <= 15) {
        titleLines.push(lines[1]);
        contentStartIndex = 2;
      }
    }
  }

  const title = titleLines.join(' - ').replace(/\s{2,}/g, ' ').trim();

  // Extract chapter number/index
  let chapterIndex = i + 1;
  const numMatch = title.match(/([0-9]+|[IVXLCDM]+)/);
  if (numMatch) {
    chapterIndex = numMatch[1];
  }

  // Get content (everything after title)
  const content = lines.slice(contentStartIndex).join('\n').trim();
  const contentWordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  return {
    json: {
      chapter_index: chapterIndex,
      chapter_title: title || `Chapter ${i + 1}`,
      content: content,
      word_count: contentWordCount,
      detection_type: chapter.candidate.type,
      detection_confidence: chapter.candidate.confidence
    }
  };
});
