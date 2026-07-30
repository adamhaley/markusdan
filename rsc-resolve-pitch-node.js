const parsed = $('Parse Answers').first().json;
const mapping = $('Vimeo Mapping').first().json;

const normalizedAnswers = parsed.normalizedAnswers || {};

function hasAnswer(stepNumber, allowedAnswers) {
  return allowedAnswers.includes(normalizedAnswers[String(stepNumber)]);
}

function resolvePitch() {
  if (hasAnswer(5, ['5b', '5c', '5d'])) {
    return {
      pitchKey: 'pitch_a_bank',
      pitch: mapping.pitches.pitch_a_bank,
      pitchReason: 'Priority 1: user has any bank savings above the none/less-than-10k bucket.',
    };
  }

  if (hasAnswer(4, ['4b', '4c', '4d', '4e'])) {
    return {
      pitchKey: 'pitch_b_life_insurance',
      pitch: mapping.pitches.pitch_b_life_insurance,
      pitchReason: 'Priority 2: user pays any life insurance amount or does not know the amount.',
    };
  }

  if (
    hasAnswer(1, ['1b', '1c', '1d', '1e']) ||
    hasAnswer(2, ['2c', '2d', '2e']) ||
    hasAnswer(3, ['3b', '3c', '3d']) ||
    hasAnswer(6, ['6b', '6c', '6d'])
  ) {
    return {
      pitchKey: 'pitch_c_everything_else',
      pitch: mapping.pitches.pitch_c_everything_else,
      pitchReason: 'Priority 3: user has qualifying real estate, stocks 10k+, metals 10k+, or alternative assets 10k+.',
    };
  }

  return {
    pitchKey: 'pitch_d_broke',
    pitch: mapping.pitches.pitch_d_broke,
    pitchReason: 'Fallback: user did not trigger bank, life insurance, or other qualifying asset pitches.',
  };
}

const resolved = resolvePitch();

return [
  {
    json: {
      ...parsed,
      ...resolved,
    },
  },
];
