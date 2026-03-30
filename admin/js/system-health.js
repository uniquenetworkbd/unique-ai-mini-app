/**
 * System Health Monitoring and Dashboard Logic
 */

class SystemHealthMonitor {
    constructor() {
        this.updateInterval = null;
        this.autoRefresh = false;
        this.bandwidthChart = null;
        this.bandwidthHistory = [];
        this.encryptionManager = new EncryptionManager();
        this.githubStorage = null;
        this.masterPassword = 'UniqueNetwork2024!'; // Should be changed in production
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.loadSettings();
        await this.loadSystemStatus();
        this.startAutoRefresh();
        this.initBandwidthChart();
        this.addLog('System initialized successfully');
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadSystemStatus();
            this.addLog('Manual refresh triggered');
        });

        // Auto-refresh toggle
        document.getElementById('autoRefreshToggle').addEventListener('change', (e) => {
            this.autoRefresh = e.target.checked;
            if (this.autoRefresh) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
            this.addLog(`Auto-refresh ${this.autoRefresh ? 'enabled' : 'disabled'}`);
        });

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('light-mode'));
            this.addLog('Theme toggled');
        });

        // Settings save
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Test connection
        document.getElementById('testConnectionBtn').addEventListener('click', () => {
            this.testConnections();
        });

        // Scan repositories
        document.getElementById('scanReposBtn').addEventListener('click', () => {
            this.scanRepositories();
        });

        // Scan ONUs
        document.getElementById('scanOnuBtn').addEventListener('click', () => {
            this.scanONUs();
        });

        // Clear logs
        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            document.getElementById('logsList').innerHTML = '';
            this.addLog('Logs cleared');
        });

        // Interface selection
        document.getElementById('interfaceSelect').addEventListener('change', () => {
            this.updateBandwidthData();
        });
    }

    setupTabNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabs = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = item.dataset.tab;
                
                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update active tab
                tabs.forEach(tab => tab.classList.remove('active'));
                document.getElementById(`${tabId}Tab`).classList.add('active');
                
                // Update page title
                const title = item.querySelector('span').textContent;
                document.getElementById('pageTitle').textContent = title;
                
                this.addLog(`Navigated to ${title}`);
            });
        });
    }

    async loadSettings() {
        const savedSettings = localStorage.getItem('ispSettings');
        if (savedSettings) {
            try {
                const settings = await this.encryptionManager.decrypt(savedSettings, this.masterPassword);
                this.applySettingsToForm(settings);
                this.addLog('Settings loaded from local storage');
            } catch (e) {
                console.error('Failed to decrypt settings:', e);
            }
        }
    }

    applySettingsToForm(settings) {
        document.getElementById('githubToken').value = settings.githubToken || '';
        document.getElementById('telegramToken').value = settings.telegramToken || '';
        document.getElementById('adminChatId').value = settings.adminChatId || '';
        document.getElementById('mikrotikIp').value = settings.mikrotikIp || '';
        document.getElementById('mikrotikPort').value = settings.mikrotikPort || '';
        document.getElementById('mikrotikUser').value = settings.mikrotikUser || '';
        document.getElementById('mikrotikPass').value = settings.mikrotikPass || '';
        document.getElementById('oltIp').value = settings.oltIp || '';
        document.getElementById('oltCommunity').value = settings.oltCommunity || '';
        document.getElementById('snmpVersion').value = settings.snmpVersion || '2c';
    }

    async saveSettings() {
        const settings = {
            githubToken: document.getElementById('githubToken').value,
            telegramToken: document.getElementById('telegramToken').value,
            adminChatId: document.getElementById('adminChatId').value,
            mikrotikIp: document.getElementById('mikrotikIp').value,
            mikrotikPort: document.getElementById('mikrotikPort').value,
            mikrotikUser: document.getElementById('mikrotikUser').value,
            mikrotikPass: document.getElementById('mikrotikPass').value,
            oltIp: document.getElementById('oltIp').value,
            oltCommunity: document.getElementById('oltCommunity').value,
            snmpVersion: document.getElementById('snmpVersion').value
        };

        try {
            const encrypted = await this.encryptionManager.encrypt(settings, this.masterPassword);
            localStorage.setItem('ispSettings', encrypted);
            this.addLog('Settings saved successfully');
            
            // Initialize GitHub storage if token provided
            if (settings.githubToken) {
                await this.initGitHubStorage(settings.githubToken);
            }
            
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        }
    }

    async initGitHubStorage(token) {
        try {
            // Try to get repo info from settings or use default
            const repoSelect = document.getElementById('repoSelect');
            const selectedRepo = repoSelect.value;
            
            if (selectedRepo) {
                const [owner, repo] = selectedRepo.split('/');
                this.githubStorage = new GitHubStorage(token, repo, owner);
                this.addLog('GitHub storage initialized');
            }
        } catch (error) {
            console.error('Failed to init GitHub storage:', error);
        }
    }

    async scanRepositories() {
        const token = document.getElementById('githubToken').value;
        if (!token) {
            alert('Please enter GitHub token first');
            return;
        }

        try {
            const tempStorage = new GitHubStorage(token, '', '');
            const repos = await tempStorage.listRepositories();
            
            const repoSelect = document.getElementById('repoSelect');
            repoSelect.innerHTML = '<option value="">Select a repository</option>';
            
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo.full_name;
                option.textContent = repo.full_name;
                repoSelect.appendChild(option);
            });
            
            this.addLog(`Found ${repos.length} repositories`);
        } catch (error) {
            console.error('Failed to scan repos:', error);
            alert('Failed to scan repositories. Check your token.');
        }
    }

    async loadSystemStatus() {
        this.updateHealthCard('github', 'checking', 'Checking...');
        this.updateHealthCard('telegram', 'checking', 'Checking...');
        this.updateHealthCard('mikrotik', 'checking', 'Checking...');
        this.updateHealthCard('olt', 'checking', 'Checking...');

        // Simulate API calls (replace with actual API calls)
        setTimeout(() => {
            this.updateHealthCard('github', 'online', 'Online', { latency: '125' });
            this.updateHealthCard('telegram', 'online', 'Online', { messages: '1,234' });
            this.updateHealthCard('mikrotik', 'warning', 'Degraded', { cpu: '45', ram: '62', uptime: '12d' });
            this.updateHealthCard('olt', 'online', 'Online', { onus: '156', warnings: '3' });
            
            this.updateBandwidthData();
            this.updateActiveUsers();
        }, 1000);
    }

    updateHealthCard(service, status, message, metrics = {}) {
        const card = document.querySelector(`.health-card[data-service="${service}"]`);
        if (!card) return;

        const statusIndicator = card.querySelector('.status-indicator');
        const statusText = statusIndicator.querySelector('.status-text');
        const pulse = statusIndicator.querySelector('.pulse');
        
        statusText.textContent = message;
        
        // Update status class
        statusIndicator.classList.remove('warning', 'error');
        if (status === 'warning') {
            statusIndicator.classList.add('warning');
            pulse.style.background = 'var(--accent-warning)';
        } else if (status === 'error') {
            statusIndicator.classList.add('error');
            pulse.style.background = 'var(--accent-danger)';
        } else if (status === 'online') {
            pulse.style.background = 'var(--accent-success)';
        } else {
            pulse.style.background = 'var(--text-secondary)';
        }
        
        // Update metrics
        Object.keys(metrics).forEach(key => {
            const metricElement = card.querySelector(`.metric .value[data-metric="${key}"]`);
            if (metricElement) {
                metricElement.textContent = metrics[key];
            } else {
                // Create metric if doesn't exist
                const metricsContainer = card.querySelector('.metrics');
                if (metricsContainer) {
                    const metricDiv = document.createElement('div');
                    metricDiv.className = 'metric';
                    metricDiv.innerHTML = `
                        <span>${key}</span>
                        <span class="value" data-metric="${key}">${metrics[key]}</span>
                    `;
                    metricsContainer.appendChild(metricDiv);
                }
            }
        });
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = `Last update: ${new Date().toLocaleTimeString()}`;
    }

    initBandwidthChart() {
        const ctx = document.getElementById('bandwidthChart').getContext('2d');
        this.bandwidthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [
                    {
                        label: 'Download (Mbps)',
                        data: Array(20).fill(0),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Upload (Mbps)',
                        data: Array(20).fill(0),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'var(--text-primary)'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Speed (Mbps)',
                            color: 'var(--text-secondary)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            color: 'var(--text-secondary)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    }
                }
            }
        });
    }

    updateBandwidthData() {
        // Simulate bandwidth data (replace with actual API calls)
        const download = Math.random() * 100;
        const upload = Math.random() * 50;
        
        document.getElementById('downloadSpeed').textContent = `${download.toFixed(1)} Mbps`;
        document.getElementById('uploadSpeed').textContent = `${upload.toFixed(1)} Mbps`;
        
        // Update chart
        this.bandwidthHistory.push({ download, upload, time: new Date() });
        if (this.bandwidthHistory.length > 20) {
            this.bandwidthHistory.shift();
        }
        
        if (this.bandwidthChart) {
            this.bandwidthChart.data.datasets[0].data = this.bandwidthHistory.map(h => h.download);
            this.bandwidthChart.data.datasets[1].data = this.bandwidthHistory.map(h => h.upload);
            this.bandwidthChart.data.labels = this.bandwidthHistory.map((_, i) => `${i}s`);
            this.bandwidthChart.update();
        }
    }

    async updateActiveUsers() {
        const tbody = document.getElementById('activeUsersList');
        
        // Simulate active users (replace with actual API call)
        const users = [
            { username: 'user001', ip: '192.168.1.100', uptime: '2h 30m', traffic: '125.5', status: 'active' },
            { username: 'user002', ip: '192.168.1.101', uptime: '1h 15m', traffic: '89.2', status: 'active' },
            { username: 'user003', ip: '192.168.1.102', uptime: '3h 45m', traffic: '234.8', status: 'active' }
        ];
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No active users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.ip}</td>
                <td>${user.uptime}</td>
                <td>${user.traffic}</td>
                <td><span class="status-badge active">${user.status}</span></td>
            </tr>
        `).join('');
    }

    async scanONUs() {
        const tbody = document.getElementById('onuList');
        tbody.innerHTML = '<tr><td colspan="6">Scanning ONUs...</td></tr>';
        
        // Simulate ONU scan (replace with actual SNMP polling)
        setTimeout(() => {
            const onus = [
                { id: 1, serial: 'BDCOM-001', rx: -18.5, tx: 2.3, status: 'online', quality: 'excellent' },
                { id: 2, serial: 'BDCOM-002', rx: -25.2, tx: 1.8, status: 'online', quality: 'good' },
                { id: 3, serial: 'BDCOM-003', rx: -28.7, tx: 2.1, status: 'warning', quality: 'poor' }
            ];
            
            let warningCount = 0;
            tbody.innerHTML = onus.map(onu => {
                if (onu.rx < -27) warningCount++;
                const qualityClass = onu.rx < -27 ? 'warning' : onu.quality;
                return `
                    <tr>
                        <td>${onu.id}</td>
                        <td>${onu.serial}</td>
                        <td class="${onu.rx < -27 ? 'warning-text' : ''}">${onu.rx} dBm</td>
                        <td>${onu.tx} dBm</td>
                        <td><span class="status-badge ${onu.status}">${onu.status}</span></td>
                        <td><span class="status-badge ${qualityClass}">${onu.quality}</span></td>
                    </tr>
                `;
            }).join('');
            
            const warningBadge = document.getElementById('onuWarningBadge');
            if (warningCount > 0) {
                warningBadge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${warningCount} ONU(s) with low signal!`;
                warningBadge.style.display = 'block';
            } else {
                warningBadge.style.display = 'none';
            }
            
            this.addLog(`ONU scan completed: ${onus.length} ONUs found, ${warningCount} with low signal`);
        }, 2000);
    }

    async testConnections() {
        this.addLog('Testing connections...');
        // Simulate connection tests
        setTimeout(() => {
            this.addLog('✓ GitHub API: Connected');
            this.addLog('✓ Telegram Bot: Connected');
            this.addLog('⚠ MikroTik: Connected but high latency');
            this.addLog('✓ OLT SNMP: Connected');
            alert('Connection tests completed. Check logs for details.');
        }, 1500);
    }

    startAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => {
            if (this.autoRefresh) {
                this.loadSystemStatus();
            }
        }, 10000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    addLog(message) {
        const logsList = document.getElementById('logsList');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        logsList.insertBefore(logEntry, logsList.firstChild);
        
        // Keep only last 100 logs
        while (logsList.children.length > 100) {
            logsList.removeChild(logsList.lastChild);
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.systemMonitor = new SystemHealthMonitor();
});
