/**
 * GitHub API integration using Octokit
 * Handles loading poses from repo and saving back via PR
 */

export class GitHubAPI {
  constructor(config) {
    this.config = config;

    // Try to find Octokit in different possible locations
    let OctokitConstructor = null;

    if (typeof window.Octokit !== 'undefined') {
      // Try window.Octokit.Octokit (v18+)
      if (typeof window.Octokit.Octokit !== 'undefined') {
        OctokitConstructor = window.Octokit.Octokit;
      }
      // Try window.Octokit directly (older versions)
      else if (typeof window.Octokit === 'function') {
        OctokitConstructor = window.Octokit;
      }
    }

    if (!OctokitConstructor) {
      throw new Error('Octokit library not loaded. Please refresh the page.');
    }

    this.octokit = new OctokitConstructor({ auth: config.token });
  }

  /**
   * Load all JSON files from the poses directory
   * @returns {Promise<Object>} Object with filename as key and parsed JSON as value
   */
  async loadPoses() {
    try {
      // Get directory contents from the specified branch
      const { data: files } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: this.config.path,
        ref: this.config.baseBranch
      });

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
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path: file.path,
            ref: this.config.baseBranch
          });

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
      if (error.status === 404) {
        throw new Error(`Repository or path not found: ${this.config.owner}/${this.config.repo}/${this.config.path} on branch ${this.config.baseBranch}`);
      } else if (error.status === 401) {
        throw new Error("Authentication failed. Please check your token.");
      } else {
        throw new Error(`Failed to load: ${error.message}`);
      }
    }
  }

  /**
   * Save poses to GitHub by creating a new branch and PR
   * @param {Object} poseData - The pose data to save (from buildPosePayload)
   * @param {string} commitMessage - Commit message
   * @returns {Promise<string>} PR URL
   */
  async savePoses(poseData, commitMessage) {
    try {
      // 1. Get the latest commit SHA from base branch
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${this.config.baseBranch}`
      });

      const baseSha = ref.object.sha;

      // 2. Create a new branch
      const timestamp = Date.now();
      const branchName = `poses-update-${timestamp}`;

      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      });

      // 3. Update the poses.json file (or create if doesn't exist)
      const filename = "poses.json";
      const filePath = `${this.config.path}/${filename}`;

      // Try to get existing file SHA
      let fileSha = null;
      try {
        const { data: existingFile } = await this.octokit.rest.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: filePath,
          ref: branchName
        });
        fileSha = existingFile.sha;
      } catch (error) {
        // File doesn't exist, will create new
        console.log("File doesn't exist, will create new");
      }

      // Create or update file
      const content = JSON.stringify(poseData, null, 2);
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: filePath,
        message: commitMessage,
        content: btoa(content),
        branch: branchName,
        sha: fileSha
      });

      // 4. Create Pull Request
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
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
      });

      return pr.html_url;
    } catch (error) {
      console.error("Failed to save poses to GitHub:", error);
      if (error.status === 401) {
        throw new Error("Authentication failed. Please check your token has 'repo' permission.");
      } else if (error.status === 403) {
        throw new Error("Permission denied. Make sure your token has 'repo' scope.");
      } else if (error.status === 404) {
        throw new Error(`Repository or branch not found: ${this.config.owner}/${this.config.repo}/${this.config.baseBranch}`);
      } else {
        throw new Error(`Failed to save: ${error.message}`);
      }
    }
  }

  /**
   * Test the connection and permissions
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: this.config.repo
      });
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async listBranches() {
    try {
      const { data: branches } = await this.octokit.rest.repos.listBranches({
        owner: this.config.owner,
        repo: this.config.repo,
        per_page: 100
      });
      return branches.map(b => b.name);
    } catch (error) {
      console.error("Failed to list branches:", error);
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }
}
