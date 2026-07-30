const testCase = $('Test Cases').item.json;
const actual = $('Call \'Wufoo Risk-Fast-Check Risiko-Schnell-Check\'').item.json;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function isEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

const actualSequenceVideoIds = [
  ...(actual.selections || []).map((item) => String(item.videoId || '')),
  String(actual.pitch?.videoId || ''),
].filter(Boolean);

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
      name: testCase.name,
      passed: failures.length === 0,
      checks,
      failures,
      actual: {
        normalizedAnswers: actual.normalizedAnswers,
        pitchKey: actual.pitchKey,
        sequenceVideoIds: actualSequenceVideoIds,
      },
    },
  },
];
