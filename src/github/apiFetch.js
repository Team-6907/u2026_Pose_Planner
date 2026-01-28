/**
 * GitHub API integration using native fetch
 * Fallback implementation if Octokit fails to load
 */

export class GitHubAPIFetch {
  constructor(config) {
    this.config = config;
    this.baseUrl = "https://api.github.com";
  }

  async request(method, path, body = null) {
    const headers = {
      "Authorization": `token ${this.config.token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async loadPoses() {
    try {
      // Get directory contents from the specified branch
      const files = await this.request(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.path}?ref=${this.config.baseBranch}`
      );

      if (!Array.isArray(files)) {
        throw new Error("Path is not a directory");
      }

      // Filter for JSON files
      const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

      if (jsonFiles.length === 0) {
        return {};
      }

      // Load each file's content
      const poses = {};
      for (const file of jsonFiles) {
        try {
          const data = await this.request(
            "GET",
            `/repos/${this.config.owner}/${this.config.repo}/contents/${file.path}?ref=${this.config.baseBranch}`
          );

          // Decode base64 content
          const content = atob(data.content.replace(/\n/g, ""));
          poses[file.name] = JSON.parse(content);
        } catch (error) {
          console.warn(`Failed to load ${file.name}:`, error);
        }
      }

      return poses;
    } catch (error) {
      console.error("Failed to load poses from GitHub:", error);
      if (error.message.includes("404")) {
        throw new Error(`Repository or path not found: ${this.config.owner}/${this.config.repo}/${this.config.path} on branch ${this.config.baseBranch}`);
      } else if (error.message.includes("401")) {
        throw new Error("Authentication failed. Please check your token.");
      } else {
        throw new Error(`Failed to load: ${error.message}`);
      }
    }
  }

  async savePoses(poseData, commitMessage) {
    try {
      // 1. Get the latest commit SHA from base branch
      const ref = await this.request(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.baseBranch}`
      );

      const baseSha = ref.object.sha;

      // 2. Create a new branch
      const timestamp = Date.now();
      const branchName = `poses-update-${timestamp}`;

      await this.request(
        "POST",
        `/repos/${this.config.owner}/${this.config.repo}/git/refs`,
        {
          ref: `refs/heads/${branchName}`,
          sha: baseSha
        }
      );

      // 3. Update the poses.json file
      const filename = "poses.json";
      const filePath = `${this.config.path}/${filename}`;

      // Try to get existing file SHA
      let fileSha = null;
      try {
        const existingFile = await this.request(
          "GET",
          `/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}?ref=${branchName}`
        );
        fileSha = existingFile.sha;
      } catch (error) {
        // File doesn't exist, will create new
        console.log("File doesn't exist, will create new");
      }

      // Create or update file
      const content = JSON.stringify(poseData, null, 2);
      const body = {
        message: commitMessage,
        content: btoa(content),
        branch: branchName
      };

      if (fileSha) {
        body.sha = fileSha;
      }

      await this.request(
        "PUT",
        `/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`,
        body
      );

      // 4. Create Pull Request
      const pr = await this.request(
        "POST",
        `/repos/${this.config.owner}/${this.config.repo}/pulls`,
        {
          title: commitMessage,
          head: branchName,
          base: this.config.baseBranch,
          body: `## Summary
Updated poses from Pose Planner web app.

## Changes
- Updated \`${filePath}\`
- Total groups: ${poseData.groups.length}
- Total poses: ${poseData.groups.reduce((sum, g) => sum + g.poses.length, 0)}

🤖 Auto-generated from [Pose Planner](https://github.com/frc2026/u2026_Pose_Planner)`
        }
      );

      return pr.html_url;
    } catch (error) {
      console.error("Failed to save poses to GitHub:", error);
      if (error.message.includes("401")) {
        throw new Error("Authentication failed. Please check your token has 'repo' permission.");
      } else if (error.message.includes("403")) {
        throw new Error("Permission denied. Make sure your token has 'repo' scope.");
      } else if (error.message.includes("404")) {
        throw new Error(`Repository or branch not found: ${this.config.owner}/${this.config.repo}/${this.config.baseBranch}`);
      } else {
        throw new Error(`Failed to save: ${error.message}`);
      }
    }
  }

  async testConnection() {
    try {
      await this.request(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}`
      );
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async listBranches() {
    try {
      const branches = await this.request(
        "GET",
        `/repos/${this.config.owner}/${this.config.repo}/branches`
      );
      return branches.map(b => b.name);
    } catch (error) {
      console.error("Failed to list branches:", error);
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }
}
