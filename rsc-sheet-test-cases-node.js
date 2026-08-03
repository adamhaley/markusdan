const ACTIVE_SUITES = [];

const ANSWER_TO_PAYLOAD = {
  "1a": {
    real_estate_ownership: "Nein",
    real_estate_investment_amount: "",
  },
  "1b": {
    real_estate_ownership: "Ja",
    real_estate_investment_amount: "weniger als €100.000",
  },
  "1c": {
    real_estate_ownership: "Ja",
    real_estate_investment_amount: "€100.000 - €500.000",
  },
  "1d": {
    real_estate_ownership: "Ja",
    real_estate_investment_amount: "€500.000 - €1.000.000",
  },
  "1e": {
    real_estate_ownership: "Ja",
    real_estate_investment_amount: "mehr als €1.000.000",
  },
  "2a": {
    securities_ownership: "Nein",
    securities_investment_amount: "",
  },
  "2b": {
    securities_ownership: "Ja",
    securities_investment_amount: "weniger als €10.000",
  },
  "2c": {
    securities_ownership: "Ja",
    securities_investment_amount: "€10.000 - €50.000",
  },
  "2d": {
    securities_ownership: "Ja",
    securities_investment_amount: "€50.000 - €100.000",
  },
  "2e": {
    securities_ownership: "Ja",
    securities_investment_amount: "mehr als €100.000",
  },
  "3a": {
    precious_metals_ownership: "Nein",
    precious_metals_investment_amount: "",
  },
  "3b": {
    precious_metals_ownership: "Ja",
    precious_metals_investment_amount: "€10.000 - €50.000",
  },
  "3c": {
    precious_metals_ownership: "Ja",
    precious_metals_investment_amount: "€50.000 - €100.000",
  },
  "3d": {
    precious_metals_ownership: "Ja",
    precious_metals_investment_amount: "mehr als €100.000",
  },
  "4a": {
    life_insurance_ownership: "Nein",
    life_insurance_monthly_payment: "",
  },
  "4b": {
    life_insurance_ownership: "Ja",
    life_insurance_monthly_payment: "weniger als €100",
  },
  "4c": {
    life_insurance_ownership: "Ja",
    life_insurance_monthly_payment: "€100 - €200",
  },
  "4d": {
    life_insurance_ownership: "Ja",
    life_insurance_monthly_payment: "mehr als €200",
  },
  "4e": {
    life_insurance_ownership: "Ja",
    life_insurance_monthly_payment: "ich weiß es nicht genau",
  },
  "5a": {
    bank_savings_ownership: "Nein",
    bank_savings_amount: "",
  },
  "5b": {
    bank_savings_ownership: "Ja",
    bank_savings_amount: "€10.000 - €50.000",
  },
  "5c": {
    bank_savings_ownership: "Ja",
    bank_savings_amount: "€50.000 - €100.000",
  },
  "5d": {
    bank_savings_ownership: "Ja",
    bank_savings_amount: "mehr als €100.000",
  },
  "6a": {
    alternative_assets_ownership: "Nein",
    alternative_assets_investment_amount: "",
  },
  "6b": {
    alternative_assets_ownership: "Ja",
    alternative_assets_investment_amount: "€10.000 - €50.000",
  },
  "6c": {
    alternative_assets_ownership: "Ja",
    alternative_assets_investment_amount: "€50.000 - €100.000",
  },
  "6d": {
    alternative_assets_ownership: "Ja",
    alternative_assets_investment_amount: "mehr als €100.000",
  },
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

function isEnabled(value) {
  return ["true", "1", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function parseSequence(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeAnswerCode(value, fieldName) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!/^[1-6][a-e]$/.test(normalized)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return normalized;
}

const items = $input.all();

return items
  .map((item, originalIndex) => ({ item, originalIndex }))
  .filter(({ item }) => {
    const row = item.json;
    const suite = String(row.suite || "").trim();

    return isEnabled(row.enabled) && (!ACTIVE_SUITES.length || ACTIVE_SUITES.includes(suite));
  })
  .map(({ item, originalIndex }) => {
    const row = item.json;
    const normalizedAnswers = {
      "1": normalizeAnswerCode(row.step_1_answer, "step_1_answer"),
      "2": normalizeAnswerCode(row.step_2_answer, "step_2_answer"),
      "3": normalizeAnswerCode(row.step_3_answer, "step_3_answer"),
      "4": normalizeAnswerCode(row.step_4_answer, "step_4_answer"),
      "5": normalizeAnswerCode(row.step_5_answer, "step_5_answer"),
      "6": normalizeAnswerCode(row.step_6_answer, "step_6_answer"),
    };

    const payload = { ...BASE_PAYLOAD };

    for (const answerCode of Object.values(normalizedAnswers)) {
      const patch = ANSWER_TO_PAYLOAD[answerCode];

      if (!patch) {
        throw new Error(`No payload mapping found for ${answerCode}`);
      }

      Object.assign(payload, patch);
    }

    payload.feedback = String(row.step_7_feedback || "").trim();
    payload.submittedAt = new Date().toISOString();

    return {
      json: {
        case_id: String(row.case_id || row.test_name || "").trim(),
        suite: String(row.suite || "").trim(),
        name: String(row.test_name || row.case_id || "").trim(),
        notes: String(row.notes || "").trim(),
        input: payload,
        expected: {
          normalizedAnswers,
          pitchKey: String(row.expected_pitch || "").trim(),
          sequenceVideoIds: parseSequence(row.expected_sequence),
        },
      },
      pairedItem: {
        item: originalIndex,
      },
    };
  });
