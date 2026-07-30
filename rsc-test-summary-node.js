const items = $input.all();

const results = items.map((item) => item.json);
const passed = results.filter((result) => result.passed);
const failed = results.filter((result) => !result.passed);

return [
  {
    json: {
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      allPassed: failed.length === 0,
      passedNames: passed.map((result) => result.name),
      failedNames: failed.map((result) => result.name),
      failures: failed.map((result) => ({
        name: result.name,
        failures: result.failures,
        actual: result.actual,
      })),
      results,
      generatedAt: new Date().toISOString(),
    },
  },
];
