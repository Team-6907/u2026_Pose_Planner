const configUrl = new URL("../../assets/field-2026/config.json", import.meta.url).toString();
const imageUrl = new URL("../../assets/field-2026/image.png", import.meta.url).toString();

export const FIELD_ASSET = {
  id: "Field2d_2026FRCFieldV1",
  name: "2026 Field",
  configUrl,
  imageUrl,
  inlineConfig: {
    name: "2026 Field",
    isFTC: false,
    coordinateSystem: "wall-blue",
    topLeft: [524, 95],
    bottomRight: [3378, 1489],
    widthInches: 651.22,
    heightInches: 317.677
  }
};
