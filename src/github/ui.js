/**
 * GitHub UI Controller
 * Handles all GitHub-related UI interactions
 */

import { GitHubConfig } from "./config.js";
import { GitHubAPI } from "./api.js";
import { GitHubAPIFetch } from "./apiFetch.js";
import { parsePosePayload, buildPosePayload } from "../io/poseIO.js";
import { syncGroupFilter, selectFirstPose, getTotalPoseCount } from "../state/poseState.js";
import { renderPoseList, updateInputsFromSelection } from "../ui/render.js";

export class GitHubUI {
  constructor(app) {
    this.app = app;
    this.config = new GitHubConfig();
    this.api = null;

    // Debug: Check what's available
    console.log('Checking Octokit availability...');
    console.log('window.Octokit:', typeof window.Octokit);
    if (window.Octokit) {
      console.log('window.Octokit.Octokit:', typeof window.Octokit.Octokit);
      console.log('window.Octokit keys:', Object.keys(window.Octokit));
    }

    // Determine which API implementation to use
    this.useOctokit = this.checkOctokitAvailable();
    console.log('Using Octokit:', this.useOctokit);
    if (!this.useOctokit) {
      console.log('Falling back to fetch API implementation');
    }

    // Cache elements
    this.elements = {
      modal: document.getElementById("githubModal"),
      settingsBtn: document.getElementById("githubSettings"),
      loadBtn: document.getElementById("loadFromRepo"),
      saveBtn: document.getElementById("saveToRepo"),
      closeBtn: document.getElementById("githubClose"),
      saveConfigBtn: document.getElementById("githubSave"),
      testBtn: document.getElementById("githubTest"),
      tokenInput: document.getElementById("githubToken"),
      ownerInput: document.getElementById("githubOwner"),
      repoInput: document.getElementById("githubRepo"),
      pathInput: document.getElementById("githubPath"),
      baseBranchInput: document.getElementById("githubBaseBranch"),
      testResult: document.getElementById("githubTestResult"),
      status: document.getElementById("githubStatus")
    };

    this.wireEvents();
    this.updateUI();
  }

  checkOctokitAvailable() {
    if (typeof window.Octokit === 'undefined') {
      return false;
    }
    // Check if we can construct it
    try {
      const OctokitConstructor = window.Octokit.Octokit || window.Octokit;
      if (typeof OctokitConstructor === 'function') {
        return true;
      }
    } catch (e) {
      console.warn('Octokit check failed:', e);
    }
    return false;
  }

  createAPI(config) {
    if (this.useOctokit) {
      try {
        return new GitHubAPI(config);
      } catch (error) {
        console.warn('Failed to create Octokit API, falling back to fetch:', error);
        this.useOctokit = false;
      }
    }
    return new GitHubAPIFetch(config);
  }

  wireEvents() {
    // Settings modal
    this.elements.settingsBtn.addEventListener("click", () => this.openSettings());
    this.elements.closeBtn.addEventListener("click", () => this.closeSettings());
    this.elements.saveConfigBtn.addEventListener("click", () => this.saveConfig());
    this.elements.testBtn.addEventListener("click", () => this.testConnection());

    // Load/Save buttons
    this.elements.loadBtn.addEventListener("click", () => this.loadFromRepo());
    this.elements.saveBtn.addEventListener("click", () => this.saveToRepo());

    // Close modal on backdrop click
    this.elements.modal.addEventListener("click", (e) => {
      if (e.target === this.elements.modal) {
        this.closeSettings();
      }
    });

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.elements.modal.classList.contains("hidden")) {
        this.closeSettings();
      }
    });
  }

  openSettings() {
    // Populate form with current config
    this.elements.tokenInput.value = this.config.token;
    this.elements.ownerInput.value = this.config.owner;
    this.elements.repoInput.value = this.config.repo;
    this.elements.pathInput.value = this.config.path;

    // Clear test result
    this.elements.testResult.className = "github-test-result";
    this.elements.testResult.textContent = "";

    this.elements.modal.classList.remove("hidden");

    // Load branches if we have owner and repo
    if (this.config.owner && this.config.repo) {
      this.loadBranches();
    } else {
      // Show placeholder
      this.elements.baseBranchInput.innerHTML = '<option value="">Enter owner and repo first</option>';
    }
  }

  async loadBranches() {
    const owner = this.elements.ownerInput.value.trim() || this.config.owner;
    const repo = this.elements.repoInput.value.trim() || this.config.repo;
    const token = this.elements.tokenInput.value.trim() || this.config.token;

    if (!owner || !repo || !token) {
      this.elements.baseBranchInput.innerHTML = '<option value="">Enter owner, repo, and token first</option>';
      return;
    }

    // Show loading state
    this.elements.baseBranchInput.innerHTML = '<option value="">Loading branches...</option>';
    this.elements.baseBranchInput.disabled = true;

    try {
      const tempConfig = { token, owner, repo, path: "", baseBranch: "" };
      const tempAPI = this.createAPI(tempConfig);
      const branches = await tempAPI.listBranches();

      // Populate dropdown
      this.elements.baseBranchInput.innerHTML = branches
        .map(branch => {
          const selected = branch === this.config.baseBranch ? 'selected' : '';
          return `<option value="${branch}" ${selected}>${branch}</option>`;
        })
        .join('');

      this.elements.baseBranchInput.disabled = false;
    } catch (error) {
      console.error("Failed to load branches:", error);
      this.elements.baseBranchInput.innerHTML = `<option value="">Failed to load branches</option>`;
      this.elements.baseBranchInput.disabled = false;
    }
  }

  closeSettings() {
    this.elements.modal.classList.add("hidden");
  }

  saveConfig() {
    const token = this.elements.tokenInput.value.trim();
    const owner = this.elements.ownerInput.value.trim();
    const repo = this.elements.repoInput.value.trim();
    const path = this.elements.pathInput.value.trim();
    const baseBranch = this.elements.baseBranchInput.value.trim();

    if (!token || !owner || !repo || !path || !baseBranch) {
      this.showTestResult("All fields are required", false);
      return;
    }

    this.config.save(token, owner, repo, path, baseBranch);
    this.api = this.createAPI(this.config);
    this.updateUI();
    this.closeSettings();
    this.setStatus("Configuration saved", "success");
  }

  async testConnection() {
    const token = this.elements.tokenInput.value.trim();
    const owner = this.elements.ownerInput.value.trim();
    const repo = this.elements.repoInput.value.trim();

    if (!token || !owner || !repo) {
      this.showTestResult("Please fill in token, owner, and repo", false);
      return;
    }

    this.elements.testBtn.disabled = true;
    this.elements.testBtn.textContent = "Testing...";
    this.showTestResult("Testing connection...", null);

    try {
      const tempConfig = { token, owner, repo, path: "", baseBranch: "" };
      const tempAPI = this.createAPI(tempConfig);
      const success = await tempAPI.testConnection();

      if (success) {
        this.showTestResult("✓ Connection successful!", true);
        // Load branches after successful connection
        await this.loadBranches();
      } else {
        this.showTestResult("✗ Connection failed", false);
      }
    } catch (error) {
      this.showTestResult(`✗ ${error.message}`, false);
    } finally {
      this.elements.testBtn.disabled = false;
      this.elements.testBtn.textContent = "Test Connection";
    }
  }

  showTestResult(message, success) {
    this.elements.testResult.textContent = message;
    this.elements.testResult.className = "github-test-result show";
    if (success === true) {
      this.elements.testResult.classList.add("success");
    } else if (success === false) {
      this.elements.testResult.classList.add("error");
    }
  }

  async loadFromRepo() {
    if (!this.config.isConfigured()) {
      this.setStatus("Please configure GitHub settings first", "error");
      this.openSettings();
      return;
    }

    if (!this.api) {
      this.api = this.createAPI(this.config);
    }

    // Confirm if there are unsaved changes
    if (this.app.state.groups.length > 0) {
      const confirmed = confirm(
        "Loading from repo will replace your current poses. Continue?"
      );
      if (!confirmed) return;
    }

    this.setStatus("Loading from repository...", "loading");
    this.elements.loadBtn.disabled = true;

    try {
      const poses = await this.api.loadPoses();
      const fileNames = Object.keys(poses);

      if (fileNames.length === 0) {
        this.setStatus("No pose files found in repository", "error");
        return;
      }

      // Use the first JSON file found (typically poses.json)
      const firstFile = fileNames[0];
      const data = poses[firstFile];

      const result = parsePosePayload(data);

      if (result.groups.length === 0) {
        this.setStatus("No valid poses found in file", "error");
        return;
      }

      // Update state
      this.app.state.groups = result.groups;
      if (result.robot) {
        this.app.state.robot = result.robot;
      }

      syncGroupFilter(this.app.state);
      selectFirstPose(this.app.state);
      updateInputsFromSelection(this.app);
      renderPoseList(this.app);

      const totalPoses = getTotalPoseCount(this.app.state);
      this.setStatus(
        `✓ Loaded ${totalPoses} poses from ${firstFile}`,
        "success"
      );
      this.app.setStatus(`Loaded ${totalPoses} poses from GitHub repository`);
    } catch (error) {
      this.setStatus(`✗ ${error.message}`, "error");
      console.error("Load from repo failed:", error);
    } finally {
      this.elements.loadBtn.disabled = false;
    }
  }

  async saveToRepo() {
    if (!this.config.isConfigured()) {
      this.setStatus("Please configure GitHub settings first", "error");
      this.openSettings();
      return;
    }

    if (!this.api) {
      this.api = this.createAPI(this.config);
    }

    if (this.app.state.groups.length === 0) {
      this.setStatus("No poses to save", "error");
      return;
    }

    // Prompt for commit message
    const commitMessage = prompt(
      "Enter commit message:",
      "Update poses from Pose Planner"
    );

    if (!commitMessage) {
      this.setStatus("Save cancelled", "");
      return;
    }

    this.setStatus("Saving to repository...", "loading");
    this.elements.saveBtn.disabled = true;

    try {
      const poseData = buildPosePayload(this.app.state);
      const prUrl = await this.api.savePoses(poseData, commitMessage);

      const totalPoses = getTotalPoseCount(this.app.state);
      this.setStatus(`✓ Created PR with ${totalPoses} poses`, "success");
      this.app.setStatus(`Pull request created: ${prUrl}`);

      // Open PR in new tab
      const openPR = confirm(
        `Pull request created successfully!\n\nOpen PR in browser?`
      );
      if (openPR) {
        window.open(prUrl, "_blank");
      }
    } catch (error) {
      this.setStatus(`✗ ${error.message}`, "error");
      console.error("Save to repo failed:", error);
    } finally {
      this.elements.saveBtn.disabled = false;
    }
  }

  setStatus(message, type = "") {
    this.elements.status.textContent = message;
    this.elements.status.className = "github-status";
    if (type) {
      this.elements.status.classList.add(type);
    }
  }

  updateUI() {
    const configured = this.config.isConfigured();

    if (configured) {
      this.setStatus(`✓ Connected to ${this.config.owner}/${this.config.repo}`, "success");
      this.elements.loadBtn.disabled = false;
      this.elements.saveBtn.disabled = false;
    } else {
      this.setStatus("⚠ Not configured", "");
      this.elements.loadBtn.disabled = true;
      this.elements.saveBtn.disabled = true;
    }
  }
}
