const ACTIVE_SUITES = [
  "regression",
  "step-option-matrix",
  "pitch-priority",
];

const INCLUDE_EXHAUSTIVE_MATRIX = false;

const STEP_ANSWERS = {
  "1": {
    a: {
      normalizedAnswer: "1a",
      videoId: "1206983454",
      payload: {
        real_estate_ownership: "Nein",
        real_estate_investment_amount: "",
      },
    },
    b: {
      normalizedAnswer: "1b",
      videoId: "1206983594",
      payload: {
        real_estate_ownership: "Ja",
        real_estate_investment_amount: "weniger als €100.000",
      },
    },
    c: {
      normalizedAnswer: "1c",
      videoId: "1206983457",
      payload: {
        real_estate_ownership: "Ja",
        real_estate_investment_amount: "€100.000 - €500.000",
      },
    },
    d: {
      normalizedAnswer: "1d",
      videoId: "1206983456",
      payload: {
        real_estate_ownership: "Ja",
        real_estate_investment_amount: "€500.000 - €1.000.000",
      },
    },
    e: {
      normalizedAnswer: "1e",
      videoId: "1206983455",
      payload: {
        real_estate_ownership: "Ja",
        real_estate_investment_amount: "mehr als €1.000.000",
      },
    },
  },
  "2": {
    a: {
      normalizedAnswer: "2a",
      videoId: "1206984659",
      payload: {
        securities_ownership: "Nein",
        securities_investment_amount: "",
      },
    },
    b: {
      normalizedAnswer: "2b",
      videoId: "1206984814",
      payload: {
        securities_ownership: "Ja",
        securities_investment_amount: "weniger als €10.000",
      },
    },
    c: {
      normalizedAnswer: "2c",
      videoId: "1206984657",
      payload: {
        securities_ownership: "Ja",
        securities_investment_amount: "€10.000 - €50.000",
      },
    },
    d: {
      normalizedAnswer: "2d",
      videoId: "1206984656",
      payload: {
        securities_ownership: "Ja",
        securities_investment_amount: "€50.000 - €100.000",
      },
    },
    e: {
      normalizedAnswer: "2e",
      videoId: "1206984655",
      payload: {
        securities_ownership: "Ja",
        securities_investment_amount: "mehr als €100.000",
      },
    },
  },
  "3": {
    a: {
      normalizedAnswer: "3a",
      videoId: "1207139423",
      payload: {
        precious_metals_ownership: "Nein",
        precious_metals_investment_amount: "",
      },
    },
    b: {
      normalizedAnswer: "3b",
      videoId: "1207139426",
      payload: {
        precious_metals_ownership: "Ja",
        precious_metals_investment_amount: "€10.000 - €50.000",
      },
    },
    c: {
      normalizedAnswer: "3c",
      videoId: "1207139424",
      payload: {
        precious_metals_ownership: "Ja",
        precious_metals_investment_amount: "€50.000 - €100.000",
      },
    },
    d: {
      normalizedAnswer: "3d",
      videoId: "1207139422",
      payload: {
        precious_metals_ownership: "Ja",
        precious_metals_investment_amount: "mehr als €100.000",
      },
    },
  },
  "4": {
    a: {
      normalizedAnswer: "4a",
      videoId: "1207139882",
      payload: {
        life_insurance_ownership: "Nein",
        life_insurance_monthly_payment: "",
      },
    },
    b: {
      normalizedAnswer: "4b",
      videoId: "1207139888",
      payload: {
        life_insurance_ownership: "Ja",
        life_insurance_monthly_payment: "weniger als €100",
      },
    },
    c: {
      normalizedAnswer: "4c",
      videoId: "1207139880",
      payload: {
        life_insurance_ownership: "Ja",
        life_insurance_monthly_payment: "€100 - €200",
      },
    },
    d: {
      normalizedAnswer: "4d",
      videoId: "1207139879",
      payload: {
        life_insurance_ownership: "Ja",
        life_insurance_monthly_payment: "mehr als €200",
      },
    },
    e: {
      normalizedAnswer: "4e",
      videoId: "1207139881",
      payload: {
        life_insurance_ownership: "Ja",
        life_insurance_monthly_payment: "ich weiß es nicht genau",
      },
    },
  },
  "5": {
    a: {
      normalizedAnswer: "5a",
      videoId: "1207146805",
      payload: {
        bank_savings_ownership: "Nein",
        bank_savings_amount: "",
      },
    },
    b: {
      normalizedAnswer: "5b",
      videoId: "1207146802",
      payload: {
        bank_savings_ownership: "Ja",
        bank_savings_amount: "€10.000 - €50.000",
      },
    },
    c: {
      normalizedAnswer: "5c",
      videoId: "1207146803",
      payload: {
        bank_savings_ownership: "Ja",
        bank_savings_amount: "€50.000 - €100.000",
      },
    },
    d: {
      normalizedAnswer: "5d",
      videoId: "1207146804",
      payload: {
        bank_savings_ownership: "Ja",
        bank_savings_amount: "mehr als €100.000",
      },
    },
  },
  "6": {
    a: {
      normalizedAnswer: "6a",
      videoId: "1207147081",
      payload: {
        alternative_assets_ownership: "Nein",
        alternative_assets_investment_amount: "",
      },
    },
    b: {
      normalizedAnswer: "6b",
      videoId: "1207147079",
      payload: {
        alternative_assets_ownership: "Ja",
        alternative_assets_investment_amount: "€10.000 - €50.000",
      },
    },
    c: {
      normalizedAnswer: "6c",
      videoId: "1207147080",
      payload: {
        alternative_assets_ownership: "Ja",
        alternative_assets_investment_amount: "€50.000 - €100.000",
      },
    },
    d: {
      normalizedAnswer: "6d",
      videoId: "1207147078",
      payload: {
        alternative_assets_ownership: "Ja",
        alternative_assets_investment_amount: "mehr als €100.000",
      },
    },
  },
};

const PITCHES = {
  pitch_a_bank: { videoId: "1207147350" },
  pitch_b_life_insurance: { videoId: "1207151195" },
  pitch_c_everything_else: { videoId: "1207155801" },
  pitch_d_broke: { videoId: "1207156045" },
};

const BASE_PAYLOAD = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  real_estate_ownership: "Nein",
  real_estate_investment_amount: "",
  securities_ownership: "Nein",
  securities_investment_amount: "",
  precious_metals_ownership: "Nein",
  precious_metals_investment_amount: "",
  life_insurance_ownership: "Nein",
  life_insurance_monthly_payment: "",
  bank_savings_ownership: "Nein",
  bank_savings_amount: "",
  alternative_assets_ownership: "Nein",
  alternative_assets_investment_amount: "",
  feedback: "",
  submittedAt: "2026-07-30T00:00:00.000Z",
};

function buildPayload(answerLettersByStep) {
  const payload = { ...BASE_PAYLOAD };

  for (const [stepNumber, answerLetter] of Object.entries(answerLettersByStep)) {
    Object.assign(payload, STEP_ANSWERS[stepNumber][answerLetter].payload);
  }

  return payload;
}

function buildNormalizedAnswers(answerLettersByStep) {
  const normalizedAnswers = {};

  for (const stepNumber of Object.keys(STEP_ANSWERS)) {
    const answerLetter = answerLettersByStep[stepNumber];
    normalizedAnswers[stepNumber] = STEP_ANSWERS[stepNumber][answerLetter].normalizedAnswer;
  }

  return normalizedAnswers;
}

function resolveExpectedPitch(normalizedAnswers) {
  if (["5b", "5c", "5d"].includes(normalizedAnswers["5"])) {
    return "pitch_a_bank";
  }

  if (["4b", "4c", "4d", "4e"].includes(normalizedAnswers["4"])) {
    return "pitch_b_life_insurance";
  }

  if (
    ["1b", "1c", "1d", "1e"].includes(normalizedAnswers["1"]) ||
    ["2c", "2d", "2e"].includes(normalizedAnswers["2"]) ||
    ["3b", "3c", "3d"].includes(normalizedAnswers["3"]) ||
    ["6b", "6c", "6d"].includes(normalizedAnswers["6"])
  ) {
    return "pitch_c_everything_else";
  }

  return "pitch_d_broke";
}

function buildExpectedSequenceVideoIds(answerLettersByStep, pitchKey) {
  const stepVideoIds = Object.keys(STEP_ANSWERS).map(
    (stepNumber) => STEP_ANSWERS[stepNumber][answerLettersByStep[stepNumber]].videoId
  );

  return [...stepVideoIds, PITCHES[pitchKey].videoId];
}

function makeCase({ suite, name, answers, notes }) {
  const normalizedAnswers = buildNormalizedAnswers(answers);
  const pitchKey = resolveExpectedPitch(normalizedAnswers);

  return {
    json: {
      suite,
      name,
      notes: notes || "",
      input: buildPayload(answers),
      expected: {
        normalizedAnswers,
        pitchKey,
        sequenceVideoIds: buildExpectedSequenceVideoIds(answers, pitchKey),
      },
    },
  };
}

function buildRegressionCases() {
  return [
    makeCase({
      suite: "regression",
      name: "pitch-c-real-estate-only",
      answers: { "1": "c", "2": "a", "3": "a", "4": "a", "5": "a", "6": "a" },
    }),
    makeCase({
      suite: "regression",
      name: "pitch-a-bank-priority-over-others",
      answers: { "1": "e", "2": "e", "3": "d", "4": "d", "5": "b", "6": "d" },
    }),
    makeCase({
      suite: "regression",
      name: "pitch-b-life-insurance-when-no-bank",
      answers: { "1": "a", "2": "a", "3": "a", "4": "e", "5": "a", "6": "a" },
    }),
    makeCase({
      suite: "regression",
      name: "pitch-d-broke-fallback",
      answers: { "1": "a", "2": "a", "3": "a", "4": "a", "5": "a", "6": "a" },
    }),
  ];
}

function buildStepOptionMatrixCases() {
  const defaults = { "1": "a", "2": "a", "3": "a", "4": "a", "5": "a", "6": "a" };
  const cases = [];

  for (const [stepNumber, answers] of Object.entries(STEP_ANSWERS)) {
    for (const answerLetter of Object.keys(answers)) {
      const testAnswers = { ...defaults, [stepNumber]: answerLetter };
      cases.push(
        makeCase({
          suite: "step-option-matrix",
          name: `step-${stepNumber}-${answerLetter}`,
          answers: testAnswers,
          notes: `Isolated coverage for step ${stepNumber} answer ${answerLetter}.`,
        })
      );
    }
  }

  return cases;
}

function buildPitchPriorityCases() {
  return [
    makeCase({
      suite: "pitch-priority",
      name: "bank-overrides-life-and-assets",
      answers: { "1": "e", "2": "e", "3": "d", "4": "e", "5": "d", "6": "d" },
      notes: "Bank pitch should win even when all other pitch triggers are also present.",
    }),
    makeCase({
      suite: "pitch-priority",
      name: "life-overrides-assets-without-bank",
      answers: { "1": "e", "2": "e", "3": "d", "4": "b", "5": "a", "6": "d" },
      notes: "Life insurance pitch should win when bank does not qualify.",
    }),
    makeCase({
      suite: "pitch-priority",
      name: "real-estate-alone-triggers-pitch-c",
      answers: { "1": "b", "2": "a", "3": "a", "4": "a", "5": "a", "6": "a" },
    }),
    makeCase({
      suite: "pitch-priority",
      name: "stocks-10k-threshold-triggers-pitch-c",
      answers: { "1": "a", "2": "c", "3": "a", "4": "a", "5": "a", "6": "a" },
    }),
    makeCase({
      suite: "pitch-priority",
      name: "metals-10k-threshold-triggers-pitch-c",
      answers: { "1": "a", "2": "a", "3": "b", "4": "a", "5": "a", "6": "a" },
    }),
    makeCase({
      suite: "pitch-priority",
      name: "alternatives-10k-threshold-triggers-pitch-c",
      answers: { "1": "a", "2": "a", "3": "a", "4": "a", "5": "a", "6": "b" },
    }),
    makeCase({
      suite: "pitch-priority",
      name: "sub-threshold-values-fall-back-to-pitch-d",
      answers: { "1": "a", "2": "b", "3": "a", "4": "a", "5": "a", "6": "a" },
      notes: "Stocks below 10k should not trigger pitch C.",
    }),
  ];
}

function buildExhaustiveMatrixCases() {
  const cases = [];
  const stepNumbers = Object.keys(STEP_ANSWERS);

  function walk(stepIndex, answers) {
    if (stepIndex >= stepNumbers.length) {
      const signature = stepNumbers.map((stepNumber) => answers[stepNumber]).join("");
      cases.push(
        makeCase({
          suite: "exhaustive-matrix",
          name: `matrix-${signature}`,
          answers: { ...answers },
        })
      );
      return;
    }

    const stepNumber = stepNumbers[stepIndex];

    for (const answerLetter of Object.keys(STEP_ANSWERS[stepNumber])) {
      answers[stepNumber] = answerLetter;
      walk(stepIndex + 1, answers);
    }
  }

  walk(0, {});
  return cases;
}

const suiteBuilders = {
  regression: buildRegressionCases,
  "step-option-matrix": buildStepOptionMatrixCases,
  "pitch-priority": buildPitchPriorityCases,
};

const cases = ACTIVE_SUITES.flatMap((suite) => suiteBuilders[suite]());

if (INCLUDE_EXHAUSTIVE_MATRIX) {
  cases.push(...buildExhaustiveMatrixCases());
}

return cases;
