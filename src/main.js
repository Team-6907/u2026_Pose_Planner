import { loadFieldAsset } from "./field/fieldLoader.js";
import { loadDefaultPoses } from "./io/poseIO.js";
import { cacheElements } from "./ui/elements.js";
import { wireEvents } from "./ui/events.js";
import { render, renderPoseList, updateInputsFromSelection } from "./ui/render.js";
import { createStatus } from "./ui/status.js";
import { createState, selectPose } from "./state/poseState.js";
import { GitHubUI } from "./github/ui.js";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const elements = cacheElements(document);
  const ctx = elements.canvas.getContext("2d");
  const state = createState();
  const setStatus = createStatus(elements);

  const app = {
    state,
    elements,
    ctx,
    setStatus,
    groupContextTarget: null
  };
  app.selectPose = (groupIndex, poseIndex) => {
    selectPose(state, groupIndex, poseIndex);
    updateInputsFromSelection(app);
    renderPoseList(app);
  };

  await loadFieldAsset(app, render);
  await loadDefaultPoses(app);
  wireEvents(app);
  render(app);

  // Initialize GitHub integration
  app.github = new GitHubUI(app);
}
