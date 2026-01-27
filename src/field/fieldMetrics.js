export function buildFieldMetrics(config) {
  const metersPerInch = 0.0254;
  const fieldLengthMeters = config.widthInches * metersPerInch;
  const fieldWidthMeters = config.heightInches * metersPerInch;
  const [left, top] = config.topLeft;
  const [right, bottom] = config.bottomRight;
  const pxPerMeterX = (right - left) / fieldLengthMeters;
  const pxPerMeterY = (bottom - top) / fieldWidthMeters;

  return {
    fieldLengthMeters,
    fieldWidthMeters,
    left,
    top,
    right,
    bottom,
    pxPerMeterX,
    pxPerMeterY
  };
}
