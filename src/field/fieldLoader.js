import { FIELD_ASSET } from "./fieldAsset.js";
import { buildFieldMetrics } from "./fieldMetrics.js";

export async function loadFieldAsset(app, render) {
  app.state.fieldConfig = FIELD_ASSET.inlineConfig;
  app.state.fieldMetrics = buildFieldMetrics(app.state.fieldConfig);

  try {
    const response = await fetch(FIELD_ASSET.configUrl);
    if (response.ok) {
      app.state.fieldConfig = await response.json();
      app.state.fieldMetrics = buildFieldMetrics(app.state.fieldConfig);
    }
  } catch (error) {
    console.warn("Using embedded config:", error.message);
  }

  try {
    app.state.image = await loadImage(FIELD_ASSET.imageUrl);
    app.elements.canvas.width = app.state.image.naturalWidth;
    app.elements.canvas.height = app.state.image.naturalHeight;
    render(app);
  } catch (error) {
    app.setStatus("Failed to load field image.", true);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}
