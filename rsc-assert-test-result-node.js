const testCase = $('Test Cases').item.json;
const actual = $('Call \'Wufoo Risk-Fast-Check Risiko-Schnell-Check\'').item.json;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function isEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

const actualSequence = Array.isArray(actual.sequence) ? actual.sequence : [];
const actualSequenceVideoIds = actualSequence
  .map((item) => String(item.videoId || "").trim())
  .filter(Boolean);

const expectedStepNumbers = ["1", "2", "3", "4", "5", "6"];
const actualStepNumbers = (actual.selections || []).map((item) => String(item.stepNumber || ""));
const actualSequenceTypes = actualSequence.map((item) => item.type);

const checks = {
  normalizedAnswers: {
    expected: testCase.expected.normalizedAnswers,
    actual: actual.normalizedAnswers,
    passed: isEqual(actual.normalizedAnswers, testCase.expected.normalizedAnswers),
  },
  pitchKey: {
    expected: testCase.expected.pitchKey,
    actual: actual.pitchKey,
    passed: actual.pitchKey === testCase.expected.pitchKey,
  },
  sequenceVideoIds: {
    expected: testCase.expected.sequenceVideoIds,
    actual: actualSequenceVideoIds,
    passed: isEqual(actualSequenceVideoIds, testCase.expected.sequenceVideoIds),
  },
  selectionsLength: {
    expected: 6,
    actual: Array.isArray(actual.selections) ? actual.selections.length : null,
    passed: Array.isArray(actual.selections) && actual.selections.length === 6,
  },
  sequenceLength: {
    expected: 7,
    actual: actualSequence.length,
    passed: actualSequence.length === 7,
  },
  selectionStepNumbers: {
    expected: expectedStepNumbers,
    actual: actualStepNumbers,
    passed: isEqual(actualStepNumbers, expectedStepNumbers),
  },
  sequenceTypes: {
    expected: ["answer", "answer", "answer", "answer", "answer", "answer", "pitch"],
    actual: actualSequenceTypes,
    passed: isEqual(actualSequenceTypes, ["answer", "answer", "answer", "answer", "answer", "answer", "pitch"]),
  },
  pitchConsistency: {
    expected: actual.pitch?.videoId || null,
    actual: actualSequence[6]?.videoId || null,
    passed: Boolean(actual.pitch?.videoId) && actual.pitch.videoId === actualSequence[6]?.videoId,
  },
};

const failures = Object.entries(checks)
  .filter(([, value]) => !value.passed)
  .map(([key, value]) => ({
    check: key,
    expected: value.expected,
    actual: value.actual,
  }));

return [
  {
    json: {
      suite: testCase.suite || "unknown",
      name: testCase.name,
      notes: testCase.notes || "",
      passed: failures.length === 0,
      checks,
      failures,
      actual: {
        normalizedAnswers: actual.normalizedAnswers,
        pitchKey: actual.pitchKey,
        sequenceVideoIds: actualSequenceVideoIds,
        sequenceTypes: actualSequenceTypes,
        selectionStepNumbers: actualStepNumbers,
      },
    },
  },
];
