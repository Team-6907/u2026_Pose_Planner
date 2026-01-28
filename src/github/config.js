/**
 * GitHub configuration management
 * Stores and retrieves GitHub settings from localStorage
 */

const CONFIG_KEY = "goatlib-github-config";

export class GitHubConfig {
  constructor() {
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        this.token = config.token || "";
        this.owner = config.owner || "";
        this.repo = config.repo || "";
        this.path = config.path || "";
        this.baseBranch = config.baseBranch || "12-pose-planner-strategy-team";
      } else {
        this.setDefaults();
      }
    } catch (error) {
      console.error("Failed to load GitHub config:", error);
      this.setDefaults();
    }
  }

  setDefaults() {
    this.token = "";
    this.owner = "Team-6907";
    this.repo = "c2026_tectonic_teal";
    this.path = "src/main/deploy/goatlib-poses";
    this.baseBranch = "12-pose-planner-strategy-team";
  }

  save(token, owner, repo, path, baseBranch) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.path = path;
    this.baseBranch = baseBranch || "12-pose-planner-strategy-team";

    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          token: this.token,
          owner: this.owner,
          repo: this.repo,
          path: this.path,
          baseBranch: this.baseBranch
        })
      );
      return true;
    } catch (error) {
      console.error("Failed to save GitHub config:", error);
      return false;
    }
  }

  isConfigured() {
    return !!(this.token && this.owner && this.repo && this.path && this.baseBranch);
  }

  clear() {
    this.setDefaults();
    try {
      localStorage.removeItem(CONFIG_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear GitHub config:", error);
      return false;
    }
  }
}
