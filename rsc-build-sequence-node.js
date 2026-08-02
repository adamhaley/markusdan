const resolved = $('Resolve Pitch').first().json;

const selectionSequence = (resolved.selections || []).map((item, index) => ({
  type: 'answer',
  order: index + 1,
  stepNumber: item.stepNumber,
  stepName: item.stepName,
  label: item.key,
  videoId: String(item.videoId || '').trim(),
}));

const pitchSequenceItem = {
  type: 'pitch',
  order: selectionSequence.length + 1,
  label: resolved.pitch.key,
  videoId: String(resolved.pitch.videoId || '').trim(),
};

const sequence = [...selectionSequence, pitchSequenceItem];

const missingVideo = sequence.find((item) => !item.videoId);

if (missingVideo) {
  throw new Error(`Sequence item is missing a videoId: ${missingVideo.label}`);
}

return [
  {
    json: {
      ...resolved,
      sequence,
      sequenceVideoIds: sequence.map((item) => item.videoId),
    },
  },
];
