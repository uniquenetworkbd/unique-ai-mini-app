/**
 * GitHub API Storage Manager
 * Handles reading/writing to GitHub repository as a database
 */

class GitHubStorage {
    constructor(token, repo, owner) {
        this.token = token;
        this.repo = repo;
        this.owner = owner;
        this.apiBase = 'https://api.github.com';
    }

    /**
     * Get file content from GitHub
     */
    async getFile(path) {
        try {
            const response = await fetch(
                `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            const content = atob(data.content);
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    }

    /**
     * Update or create file in GitHub
     */
    async updateFile(path, content, message) {
        try {
            // Get current file info if exists
            let sha = null;
            try {
                const response = await fetch(
                    `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`,
                    {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    sha = data.sha;
                }
            } catch (e) {
                // File doesn't exist, will create new
            }

            // Prepare file content
            const contentBase64 = btoa(JSON.stringify(content, null, 2));

            // Update or create file
            const response = await fetch(
                `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        content: contentBase64,
                        sha: sha,
                        branch: 'main'
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update file: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating file:', error);
            throw error;
        }
    }

    /**
     * List repositories for authenticated user
     */
    async listRepositories() {
        try {
            const response = await fetch(
                `${this.apiBase}/user/repos?per_page=100&sort=updated`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to list repos: ${response.status}`);
            }

            const repos = await response.json();
            return repos.map(repo => ({
                name: repo.name,
                full_name: repo.full_name,
                owner: repo.owner.login
            }));
        } catch (error) {
            console.error('Error listing repositories:', error);
            throw error;
        }
    }

    /**
     * Save configuration to GitHub
     */
    async saveConfig(config) {
        return await this.updateFile(
            'data/config.json',
            config,
            'Update system configuration'
        );
    }

    /**
     * Load configuration from GitHub
     */
    async loadConfig() {
        return await this.getFile('data/config.json');
    }

    /**
     * Save network statistics
     */
    async saveNetworkStats(stats) {
        return await this.updateFile(
            'data/network_stats.json',
            stats,
            'Update network statistics'
        );
    }

    /**
     * Load network statistics
     */
    async loadNetworkStats() {
        return await this.getFile('data/network_stats.json');
    }
}

// Export for use in other modules
window.GitHubStorage = GitHubStorage;
