const payload = $("When Executed by Another Workflow").first().json;
const mapping = $('Vimeo Mapping').first().json;

function normalize(value) {
  return String(value || '').trim();
}

function expectValue(value, fieldName) {
  const normalized = normalize(value);

  if (!normalized) {
    throw new Error(`Missing required field: ${fieldName}`);
  }

  return normalized;
}

function valueOrDefault(value, fallback) {
  return normalize(value) || fallback;
}

function resolveStep1(data) {
  const ownership = expectValue(data.real_estate_ownership, 'real_estate_ownership');

  if (ownership === 'Nein') {
    return '1a';
  }

  const amount = valueOrDefault(data.real_estate_investment_amount, 'weniger als €100.000');

  if (amount === 'weniger als €100.000') return '1b';
  if (amount === '€100.000 - €500.000') return '1c';
  if (amount === '€500.000 - €1.000.000') return '1d';
  if (amount === 'mehr als €1.000.000') return '1e';

  throw new Error(`Unexpected real_estate_investment_amount: ${amount}`);
}

function resolveStep2(data) {
  const ownership = expectValue(data.securities_ownership, 'securities_ownership');

  if (ownership === 'Nein') {
    return '2a';
  }

  const amount = valueOrDefault(data.securities_investment_amount, 'weniger als €10.000');

  if (amount === 'weniger als €10.000') return '2b';
  if (amount === '€10.000 - €50.000') return '2c';
  if (amount === '€50.000 - €100.000') return '2d';
  if (amount === 'mehr als €100.000') return '2e';

  throw new Error(`Unexpected securities_investment_amount: ${amount}`);
}

function resolveStep3(data) {
  const ownership = expectValue(data.precious_metals_ownership, 'precious_metals_ownership');

  if (ownership === 'Nein') {
    return '3a';
  }

  const amount = valueOrDefault(data.precious_metals_investment_amount, 'weniger als €10.000');

  if (amount === 'weniger als €10.000') return '3a';
  if (amount === '€10.000 - €50.000') return '3b';
  if (amount === '€50.000 - €100.000') return '3c';
  if (amount === 'mehr als €100.000') return '3d';

  throw new Error(`Unexpected precious_metals_investment_amount: ${amount}`);
}

function resolveStep4(data) {
  const ownership = expectValue(data.life_insurance_ownership, 'life_insurance_ownership');

  if (ownership === 'Nein') {
    return '4a';
  }

  const payment = valueOrDefault(data.life_insurance_monthly_payment, 'weniger als €100');

  if (payment === 'weniger als €100') return '4b';
  if (payment === '€100 - €200') return '4c';
  if (payment === 'mehr als €200') return '4d';
  if (payment === 'ich weiß es nicht genau') return '4e';

  throw new Error(`Unexpected life_insurance_monthly_payment: ${payment}`);
}

function resolveStep5(data) {
  const ownership = expectValue(data.bank_savings_ownership, 'bank_savings_ownership');

  if (ownership === 'Nein') {
    return '5a';
  }

  const amount = valueOrDefault(data.bank_savings_amount, 'weniger als €10.000');

  if (amount === 'weniger als €10.000') return '5a';
  if (amount === '€10.000 - €50.000') return '5b';
  if (amount === '€50.000 - €100.000') return '5c';
  if (amount === 'mehr als €100.000') return '5d';

  throw new Error(`Unexpected bank_savings_amount: ${amount}`);
}

function resolveStep6(data) {
  const ownership = expectValue(data.alternative_assets_ownership, 'alternative_assets_ownership');

  if (ownership === 'Nein') {
    return '6a';
  }

  const amount = valueOrDefault(data.alternative_assets_investment_amount, 'weniger als €10.000');

  if (amount === 'weniger als €10.000') return '6a';
  if (amount === '€10.000 - €50.000') return '6b';
  if (amount === '€50.000 - €100.000') return '6c';
  if (amount === 'mehr als €100.000') return '6d';

  throw new Error(`Unexpected alternative_assets_investment_amount: ${amount}`);
}

const normalizedAnswers = {
  "1": resolveStep1(payload),
  "2": resolveStep2(payload),
  "3": resolveStep3(payload),
  "4": resolveStep4(payload),
  "5": resolveStep5(payload),
  "6": resolveStep6(payload),
};

const selections = Object.values(normalizedAnswers).map((answerCode) => {
  const answer = mapping.answerLookup[answerCode];

  if (!answer) {
    throw new Error(`No Vimeo mapping found for ${answerCode}`);
  }

  return {
    stepNumber: answer.stepNumber,
    normalizedAnswer: answerCode,
    answerLetter: answer.answerLetter,
    stepName: answer.stepName,
    clipKey: answer.clipKey,
    introVideoId: answer.introVideoId,
    key: answer.key,
    videoId: answer.videoId,
  };
});

return [
  {
    json: {
      normalizedAnswers,
      selections,
      feedback: normalize(payload.feedback),
      submittedAt: payload.submittedAt || null,
      rawPayload: payload,
    },
  },
];
