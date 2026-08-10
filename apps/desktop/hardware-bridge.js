function normalizeHardwarePayload(payload) {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return {
      type: trimmed ? 'scan' : 'unknown',
      value: trimmed,
    };
  }

  if (payload && typeof payload === 'object') {
    const maybeType = typeof payload.type === 'string' ? payload.type : '';
    const maybeValue = typeof payload.value === 'string' ? payload.value.trim() : '';

    if (maybeType === 'weight') {
      return {
        type: 'weight',
        value: maybeValue,
        stable: !!payload.stable,
      };
    }

    if (maybeValue) {
      return {
        type: 'unknown',
        value: maybeValue,
      };
    }
  }

  return {
    type: 'unknown',
    value: '',
  };
}

module.exports = {
  normalizeHardwarePayload,
};
