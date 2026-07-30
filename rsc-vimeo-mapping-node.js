const steps = {
  "1": {
    name: "real_estate",
    clipKey: "RSCL_F1_RealEstate_Immobilien",
    introVideoId: "1206982769",
    answers: {
      a: { key: "RSCL_A1a_no_realestate", videoId: "1206983454" },
      b: { key: "RSCL_A1b_0-100k", videoId: "1206983594" },
      c: { key: "RSCL_A1c_100k-500k", videoId: "1206983457" },
      d: { key: "RSCL_A1d_500k-1m", videoId: "1206983456" },
      e: { key: "RSCL_A1e_1m_plus", videoId: "1206983455" },
    },
  },
  "2": {
    name: "stocks",
    clipKey: "RSCL_F2_Stocks_Aktien",
    introVideoId: "1206982979",
    answers: {
      a: { key: "RSCL_A2a_no_stocks", videoId: "1206984659" },
      b: { key: "RSCL_A2b_0-10k", videoId: "1206984814" },
      c: { key: "RSCL_A2c_10k-50k", videoId: "1206984657" },
      d: { key: "RSCL_A2d_50k-100k", videoId: "1206984656" },
      e: { key: "RSCL_A2e_100k_plus", videoId: "1206984655" },
    },
  },
  "3": {
    name: "precious_metals",
    clipKey: "RSCL_F3_Preciousmetals_Edelmetalle",
    introVideoId: "1206982890",
    answers: {
      a: { key: "RSCL_A3a_none_or_less10k", videoId: "1207139423" },
      b: { key: "RSCL_A3b_10k-50k", videoId: "1207139426" },
      c: { key: "RSCL_A3c_50k-100k", videoId: "1207139424" },
      d: { key: "RSCL_A3d_100k_plus", videoId: "1207139422" },
    },
  },
  "4": {
    name: "life_insurance",
    clipKey: "RSCL_F4_Lifeinsurance_LV",
    introVideoId: "1206982762",
    answers: {
      a: { key: "RSCL_A4a_no_insurance", videoId: "1207139882" },
      b: { key: "RSCL_A4b_up_to_100", videoId: "1207139888" },
      c: { key: "RSCL_A4c_100-200", videoId: "1207139880" },
      d: { key: "RSCL_A4d_200plus", videoId: "1207139879" },
      e: { key: "RSCL_A4e_dont_know", videoId: "1207139881" },
    },
  },
  "5": {
    name: "bank",
    clipKey: "RSCL_F5_Bank",
    introVideoId: "1206982764",
    answers: {
      a: { key: "RSCL_A5a_none_or_less10k", videoId: "1207146805" },
      b: { key: "RSCL_A5b_10k-50k", videoId: "1207146802" },
      c: { key: "RSCL_A5c_50k-100k", videoId: "1207146803" },
      d: { key: "RSCL_A5d_100k_plus", videoId: "1207146804" },
    },
  },
  "6": {
    name: "alternative_investments",
    clipKey: "RSCL_F6_AlternativInvest",
    introVideoId: "1206982763",
    answers: {
      a: { key: "RSCL_A6a_none_or_less10k", videoId: "1207147081" },
      b: { key: "RSCL_A6b_10k-50k", videoId: "1207147079" },
      c: { key: "RSCL_A6c_50k-100k", videoId: "1207147080" },
      d: { key: "RSCL_A6d_100k_plus", videoId: "1207147078" },
    },
  },
};

const pitches = {
  pitch_a_bank: {
    key: "RSCL_Pitch_A_Bank",
    videoId: "1207147350",
    rule: "Priority 1: only if user has any money in the bank bucket above none/less10k.",
  },
  pitch_b_life_insurance: {
    key: "RSCL_Pitch_B_LifeInsurance",
    videoId: "1207151195",
    rule: "Priority 2: if not pitch A, and user pays any amount to life insurance or does not know.",
  },
  pitch_c_everything_else: {
    key: "RSCL_Pitch_C_Everything_Else",
    videoId: "1207155801",
    rule: "Priority 3: if not pitch A or B, and user has any qualifying assets in real estate, stocks, metals, or alternatives.",
  },
  pitch_d_broke: {
    key: "RSCL_Pitch_D_broke",
    videoId: "1207156045",
    rule: "Fallback: only if user effectively has no qualifying assets and no life insurance contribution.",
  },
};

const answerLookup = {};

for (const [stepNumber, step] of Object.entries(steps)) {
  for (const [answerLetter, answer] of Object.entries(step.answers)) {
    answerLookup[`${stepNumber}${answerLetter}`] = {
      ...answer,
      stepNumber,
      answerLetter,
      stepName: step.name,
      clipKey: step.clipKey,
      introVideoId: step.introVideoId,
    };
  }
}

return [
  {
    json: {
      steps,
      pitches,
      answerLookup,
    },
  },
];
