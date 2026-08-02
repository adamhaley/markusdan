const items = $input.all();

const results = items.map((item) => item.json);
const passed = results.filter((result) => result.passed);
const failed = results.filter((result) => !result.passed);

const suiteSummary = Object.values(
  results.reduce((accumulator, result) => {
    const suite = result.suite || "unknown";

    if (!accumulator[suite]) {
      accumulator[suite] = {
        suite,
        total: 0,
        passed: 0,
        failed: 0,
        failedNames: [],
      };
    }

    accumulator[suite].total += 1;

    if (result.passed) {
      accumulator[suite].passed += 1;
    } else {
      accumulator[suite].failed += 1;
      accumulator[suite].failedNames.push(result.name);
    }

    return accumulator;
  }, {})
);

return [
  {
    json: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      allPassed: failed.length === 0,
      passedNames: passed.map((result) => result.name),
      failedNames: failed.map((result) => result.name),
      suiteSummary,
      failures: failed.map((result) => ({
        suite: result.suite,
        name: result.name,
        notes: result.notes,
        failures: result.failures,
        actual: result.actual,
      })),
      results,
      generatedAt: new Date().toISOString(),
    },
  },
];
