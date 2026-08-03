const testCase = $('Test Cases').item.json;
const assertion = $input.first().json;

const actualPitch = String(assertion.actual?.pitchKey || "").trim();
const actualSequence = (assertion.actual?.sequenceVideoIds || []).join("|");
const failureReason = (assertion.failures || [])
  .map((failure) => {
    const expected = JSON.stringify(failure.expected);
    const actual = JSON.stringify(failure.actual);
    return `${failure.check}: expected ${expected}, actual ${actual}`;
  })
  .join(" || ");

return [
  {
    json: {
      case_id: testCase.case_id,
      actual_pitch: actualPitch,
      actual_sequence: actualSequence,
      pass: assertion.passed ? "TRUE" : "FALSE",
      last_run_at: new Date().toISOString(),
      failure_reason: failureReason,

      // Keep summary-friendly fields on the item in case you want this branch
      // to feed a report later.
      suite: assertion.suite,
      name: assertion.name,
      passed: assertion.passed,
      failures: assertion.failures,
      actual: assertion.actual,
    },
  },
];
