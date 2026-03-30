/**
 * Enhanced System Health Monitor with Manual Controls & Nano AI
 * Version: 2.0.0
 * Features:
 * - Manual service toggles with independent polling
 * - Incremental updates without session reset
 * - Nano AI assistant with DOM-based context
 * - Status LED indicators
 */

class SystemHealthMonitor {
    constructor() {
        // Service status tracking
        this.services = {
            github: {
                enabled: false,
                connected: false,
                pollingInterval: null,
                data: { latency: null, lastSync: null },
                credentials: null,
                lastUpdate: null
            },
            telegram: {
                enabled: false,
                connected: false,
                pollingInterval: null,
                data: { messagesToday: 0, lastMessage: null },
                credentials: null,
                lastUpdate: null
            },
            mikrotik: {
                enabled: false,
                connected: false,
                pollingInterval: null,
                data: { cpu: 0, ram: 0, uptime: '--', users: [], bandwidth: { download: 0, upload: 0 } },
                credentials: null,
                lastUpdate: null
            },
            olt: {
                enabled: false,
                connected: false,
                pollingInterval: null,
                data: { totalOnus: 0, onlineOnus: 0, signalWarnings: 0, onus: [] },
                credentials: null,
                lastUpdate: null
            }
        };

        // UI References
        this.chart = null;
        this.bandwidthHistory = [];
        this.autoRefresh = true;
        this.updateInterval = null;
        
        // AI Context (updated without network calls)
        this.aiContext = {
            lastUpdate: null,
            systemState: {}
        };
        
        // Encryption
        this.encryptionKey = 'UniqueNetwork2024!';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupAIAssistant();
        await this.loadCredentials();
        this.setupServiceToggles();
        this.initBandwidthChart();
        this.startAutoRefresh();
        this.startAIContextUpdater();
        this.addLog('System initialized with manual controls');
    }

    setupEventListeners() {
        // Manual refresh - only refreshes UI from existing data
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshUIFromData();
                this.addLog('Manual UI refresh');
            });
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.autoRefresh = e.target.checked;
                if (this.autoRefresh) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
                this.addLog(`Auto-refresh ${this.autoRefresh ? 'ON' : 'OFF'}`);
            });
        }

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('light-mode');
                localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
            });
            
            // Load saved theme
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-mode');
            }
        }

        // Settings save
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveCredentials());
        }

        // Test connections
        const testConnBtn = document.getElementById('testConnectionBtn');
        if (testConnBtn) {
            testConnBtn.addEventListener('click', () => this.testConnections());
        }

        // Scan repos
        const scanReposBtn = document.getElementById('scanReposBtn');
        if (scanReposBtn) {
            scanReposBtn.addEventListener('click', () => this.scanRepositories());
        }

        // Scan ONUs
        const scanOnuBtn = document.getElementById('scanOnuBtn');
        if (scanOnuBtn) {
            scanOnuBtn.addEventListener('click', () => this.manualScanONUs());
        }

        // Clear logs
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                const logsList = document.getElementById('logsList');
                if (logsList) logsList.innerHTML = '';
                this.addLog('Logs cleared');
            });
        }

        // Interface select for bandwidth
        const interfaceSelect = document.getElementById('interfaceSelect');
        if (interfaceSelect) {
            interfaceSelect.addEventListener('change', () => {
                if (this.services.mikrotik.connected) {
                    this.fetchMikroTikData();
                }
            });
        }
    }

    setupServiceToggles() {
        const services = ['github', 'telegram', 'mikrotik', 'olt'];
        
        services.forEach(service => {
            const toggle = document.querySelector(`.service-toggle-input[data-service="${service}"]`);
            if (!toggle) return;
            
            // Load saved state
            const savedState = localStorage.getItem(`service_${service}_enabled`);
            if (savedState !== null) {
                this.services[service].enabled = savedState === 'true';
                toggle.checked = this.services[service].enabled;
                this.updateToggleLabel(toggle, this.services[service].enabled);
                
                if (this.services[service].enabled) {
                    // Auto-connect if credentials exist
                    this.connectService(service);
                } else {
                    this.updateServiceUI(service, 'disconnected', 'Disconnected');
                }
            }
            
            // Add change listener
            toggle.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                this.services[service].enabled = enabled;
                localStorage.setItem(`service_${service}_enabled`, enabled);
                this.updateToggleLabel(toggle, enabled);
                
                if (enabled) {
                    await this.connectService(service);
                } else {
                    this.disconnectService(service);
                }
            });
        });
    }

    updateToggleLabel(toggle, enabled) {
        const label = toggle.closest('.service-toggle')?.querySelector('.toggle-label');
        if (label) {
            label.textContent = enabled ? 'ON' : 'OFF';
        }
    }

    async connectService(service) {
        this.addLog(`Connecting to ${service}...`);
        this.updateServiceUI(service, 'connecting', 'Connecting...');
        
        try {
            // Load credentials from storage
            const credentials = await this.getCredentials(service);
            
            if (!credentials) {
                this.updateServiceUI(service, 'error', 'No credentials found');
                this.addLog(`${service}: No credentials configured`);
                return;
            }
            
            this.services[service].credentials = credentials;
            
            // Simulate connection test (replace with actual API calls)
            const connected = await this.testConnection(service, credentials);
            
            if (connected) {
                this.services[service].connected = true;
                this.updateServiceUI(service, 'online', 'Connected');
                this.addLog(`${service} connected successfully`);
                
                // Start polling for this service
                this.startPolling(service);
                
                // Fetch initial data
                await this.fetchServiceData(service);
            } else {
                this.updateServiceUI(service, 'error', 'Connection failed');
                this.addLog(`${service} connection failed`);
            }
        } catch (error) {
            console.error(`Failed to connect ${service}:`, error);
            this.updateServiceUI(service, 'error', 'Connection error');
            this.addLog(`${service} connection error: ${error.message}`);
        }
    }

    disconnectService(service) {
        this.addLog(`Disconnecting ${service}...`);
        
        // Stop polling
        if (this.services[service].pollingInterval) {
            clearInterval(this.services[service].pollingInterval);
            this.services[service].pollingInterval = null;
        }
        
        this.services[service].connected = false;
        this.services[service].data = this.getDefaultData(service);
        this.updateServiceUI(service, 'disconnected', 'Disconnected');
        this.addLog(`${service} disconnected`);
        
        // Refresh UI to show disconnected state
        this.refreshUIFromData();
    }

    startPolling(service) {
        if (this.services[service].pollingInterval) {
            clearInterval(this.services[service].pollingInterval);
        }
        
        // Different polling intervals per service
        const intervals = {
            github: 30000,    // 30 seconds
            telegram: 60000,  // 60 seconds
            mikrotik: 10000,  // 10 seconds (critical for real-time)
            olt: 30000        // 30 seconds
        };
        
        this.services[service].pollingInterval = setInterval(() => {
            if (this.services[service].enabled && this.services[service].connected) {
                this.fetchServiceData(service);
            }
        }, intervals[service]);
    }

    async fetchServiceData(service) {
        if (!this.services[service].connected || !this.services[service].credentials) {
            return;
        }
        
        try {
            let data = null;
            
            switch(service) {
                case 'github':
                    data = await this.fetchGitHubData(this.services[service].credentials);
                    break;
                case 'telegram':
                    data = await this.fetchTelegramData(this.services[service].credentials);
                    break;
                case 'mikrotik':
                    data = await this.fetchMikroTikData(this.services[service].credentials);
                    break;
                case 'olt':
                    data = await this.fetchOLTData(this.services[service].credentials);
                    break;
            }
            
            if (data) {
                this.services[service].data = { ...this.services[service].data, ...data };
                this.services[service].lastUpdate = new Date();
                this.updateServiceUI(service, 'online', 'Connected');
                this.updateServiceMetrics(service, data);
                this.refreshUIFromData();
            }
        } catch (error) {
            console.error(`Failed to fetch ${service} data:`, error);
            this.updateServiceUI(service, 'warning', 'Data fetch failed');
        }
    }

    updateServiceUI(service, status, message) {
        const card = document.querySelector(`.health-card[data-service="${service}"]`);
        if (!card) return;
        
        const statusText = card.querySelector('.status-text');
        const led = card.querySelector(`.status-led[data-service="${service}-led"]`);
        
        if (statusText) statusText.textContent = message;
        
        // Update LED
        if (led) {
            led.className = 'status-led';
            if (status === 'online') {
                led.classList.add('active');
            } else if (status === 'disconnected') {
                led.classList.add('disconnected');
            } else if (status === 'connecting' || status === 'warning') {
                led.classList.add('idle');
            }
        }
        
        // Update card opacity
        if (status === 'disconnected') {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    }

    updateServiceMetrics(service, data) {
        const card = document.querySelector(`.health-card[data-service="${service}"]`);
        if (!card) return;
        
        switch(service) {
            case 'github':
                const latency = card.querySelector('[data-metric="latency"]');
                const lastSync = card.querySelector('[data-metric="last-sync"]');
                if (latency) latency.textContent = `${data.latency || 125} ms`;
                if (lastSync) lastSync.textContent = data.lastSync || new Date().toLocaleTimeString();
                break;
                
            case 'telegram':
                const messages = card.querySelector('[data-metric="messages"]');
                const lastMsg = card.querySelector('[data-metric="last-message"]');
                if (messages) messages.textContent = data.messagesToday || '0';
                if (lastMsg) lastMsg.textContent = data.lastMessage || '--';
                break;
                
            case 'mikrotik':
                const cpu = card.querySelector('[data-metric="cpu"]');
                const ram = card.querySelector('[data-metric="ram"]');
                const uptime = card.querySelector('[data-metric="uptime"]');
                if (cpu) cpu.textContent = `${data.cpu || 0}%`;
                if (ram) ram.textContent = `${data.ram || 0}%`;
                if (uptime) uptime.textContent = data.uptime || '--';
                
                // Update progress circles if visible
                this.updateProgressCircles(data);
                break;
                
            case 'olt':
                const onusOnline = card.querySelector('[data-metric="onus-online"]');
                const warnings = card.querySelector('[data-metric="warnings"]');
                if (onusOnline) onusOnline.textContent = data.onlineOnus || '0';
                if (warnings) warnings.textContent = data.signalWarnings || '0';
                break;
        }
    }

    refreshUIFromData() {
        // Update last update timestamp
        const lastUpdateSpan = document.getElementById('lastUpdate');
        if (lastUpdateSpan) {
            lastUpdateSpan.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
        }
        
        // Update MikroTik data
        if (this.services.mikrotik.connected && this.services.mikrotik.data) {
            this.updateActiveUsersTable(this.services.mikrotik.data.users || []);
            this.updateBandwidthDisplay(this.services.mikrotik.data.bandwidth || { download: 0, upload: 0 });
        } else {
            this.updateActiveUsersTable([]);
        }
        
        // Update OLT data
        if (this.services.olt.connected && this.services.olt.data) {
            this.updateONUTable(this.services.olt.data.onus || []);
            this.updateONUWarningBadge(this.services.olt.data.signalWarnings || 0);
        } else {
            this.updateONUTable([]);
        }
    }

    updateActiveUsersTable(users) {
        const tbody = document.getElementById('activeUsersList');
        if (!tbody) return;
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No active users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${this.escapeHtml(user.username || 'unknown')}</td>
                <td>${this.escapeHtml(user.address || '--')}</td>
                <td>${this.escapeHtml(user.uptime || '--')}</td>
                <td>${Math.round((user.bytesIn + user.bytesOut) / 1048576)}</td>
                <td><span class="status-badge active">active</span></td>
            </tr>
        `).join('');
    }

    updateBandwidthDisplay(bandwidth) {
        const downloadSpan = document.getElementById('downloadSpeed');
        const uploadSpan = document.getElementById('uploadSpeed');
        
        if (downloadSpan) {
            downloadSpan.textContent = `${(bandwidth.download || 0).toFixed(1)} Mbps`;
        }
        if (uploadSpan) {
            uploadSpan.textContent = `${(bandwidth.upload || 0).toFixed(1)} Mbps`;
        }
        
        // Update chart
        const download = bandwidth.download || 0;
        const upload = bandwidth.upload || 0;
        
        this.bandwidthHistory.push({ download, upload, time: new Date() });
        if (this.bandwidthHistory.length > 20) {
            this.bandwidthHistory.shift();
        }
        
        if (this.chart) {
            this.chart.data.datasets[0].data = this.bandwidthHistory.map(h => h.download);
            this.chart.data.datasets[1].data = this.bandwidthHistory.map(h => h.upload);
            this.chart.update();
        }
    }

    updateONUTable(onus) {
        const tbody = document.getElementById('onuList');
        if (!tbody) return;
        
        if (!onus || onus.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No ONU data available</td></tr>';
            return;
        }
        
        tbody.innerHTML = onus.map(onu => {
            const isWarning = onu.rxPower < -27;
            const qualityClass = isWarning ? 'warning' : (onu.quality || 'good');
            return `
                <tr>
                    <td>${onu.id || '--'}</td>
                    <td>${this.escapeHtml(onu.serial || '--')}</td>
                    <td class="${isWarning ? 'warning-text' : ''}">${onu.rxPower || 0} dBm</td>
                    <td>${onu.txPower || 0} dBm</td>
                    <td><span class="status-badge ${onu.status || 'online'}">${onu.status || 'online'}</span></td>
                    <td><span class="status-badge ${qualityClass}">${qualityClass}</span></td>
                </tr>
            `;
        }).join('');
    }

    updateONUWarningBadge(warningCount) {
        const badge = document.getElementById('onuWarningBadge');
        if (!badge) return;
        
        if (warningCount > 0) {
            badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${warningCount} ONU(s) with low signal!`;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    updateProgressCircles(data) {
        const cpuCircle = document.querySelector('.progress-circle[data-metric="cpu"]');
        const ramCircle = document.querySelector('.progress-circle[data-metric="ram"]');
        
        if (cpuCircle && data.cpu !== undefined) {
            const percent = Math.min(100, Math.max(0, data.cpu));
            const circle = cpuCircle.querySelector('.circle');
            const percentage = cpuCircle.querySelector('.percentage');
            
            if (circle) {
                const dashOffset = 100 - percent;
                circle.style.strokeDashoffset = dashOffset;
                circle.style.stroke = percent > 80 ? '#ef4444' : percent > 60 ? '#f59e0b' : '#10b981';
            }
            if (percentage) percentage.textContent = `${percent}%`;
        }
        
        if (ramCircle && data.ram !== undefined) {
            const percent = Math.min(100, Math.max(0, data.ram));
            const circle = ramCircle.querySelector('.circle');
            const percentage = ramCircle.querySelector('.percentage');
            
            if (circle) {
                const dashOffset = 100 - percent;
                circle.style.strokeDashoffset = dashOffset;
            }
            if (percentage) percentage.textContent = `${percent}%`;
        }
    }

    initBandwidthChart() {
        const canvas = document.getElementById('bandwidthChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
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

    startAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (this.autoRefresh) {
                this.refreshUIFromData();
            }
        }, 10000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // ============================================================================
    // Nano AI Assistant Implementation
    // ============================================================================

    setupAIAssistant() {
        this.aiWidget = document.getElementById('nanoAiWidget');
        this.aiToggleBtn = document.getElementById('aiToggleBtn');
        
        // Widget controls
        const minimizeBtn = document.getElementById('aiMinimizeBtn');
        const closeBtn = document.getElementById('aiCloseBtn');
        const sendBtn = document.getElementById('aiSendBtn');
        const userInput = document.getElementById('aiUserInput');
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleAIWidget());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideAIWidget());
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.processAIQuery());
        }
        
        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.processAIQuery();
            });
        }
        
        if (this.aiToggleBtn) {
            this.aiToggleBtn.addEventListener('click', () => this.showAIWidget());
        }
        
        // Load saved widget state
        const wasHidden = localStorage.getItem('aiWidgetHidden');
        if (wasHidden === 'true') {
            this.hideAIWidget();
        } else {
            this.showAIWidget();
        }
        
        this.addAIMessage('system', '👋 Hello! I\'m your Nano AI Assistant. I can analyze network status and answer questions. Try asking "status", "health", or "summary".');
    }

    startAIContextUpdater() {
        // Update AI context every 10 seconds WITHOUT network calls
        setInterval(() => {
            this.updateAIContext();
        }, 10000);
        
        // Initial update
        this.updateAIContext();
    }

    updateAIContext() {
        // Collect current system state from DOM and service data
        this.aiContext = {
            timestamp: new Date().toISOString(),
            lastUpdate: new Date().toLocaleTimeString(),
            services: {
                github: {
                    enabled: this.services.github.enabled,
                    connected: this.services.github.connected,
                    latency: this.services.github.data?.latency
                },
                telegram: {
                    enabled: this.services.telegram.enabled,
                    connected: this.services.telegram.connected,
                    messages: this.services.telegram.data?.messagesToday
                },
                mikrotik: {
                    enabled: this.services.mikrotik.enabled,
                    connected: this.services.mikrotik.connected,
                    cpu: this.services.mikrotik.data?.cpu,
                    ram: this.services.mikrotik.data?.ram,
                    uptime: this.services.mikrotik.data?.uptime,
                    activeUsers: this.services.mikrotik.data?.users?.length || 0,
                    bandwidth: this.services.mikrotik.data?.bandwidth
                },
                olt: {
                    enabled: this.services.olt.enabled,
                    connected: this.services.olt.connected,
                    totalOnus: this.services.olt.data?.totalOnus || 0,
                    onlineOnus: this.services.olt.data?.onlineOnus || 0,
                    signalWarnings: this.services.olt.data?.signalWarnings || 0
                }
            },
            autoRefresh: this.autoRefresh
        };
    }

    async processAIQuery() {
        const input = document.getElementById('aiUserInput');
        const query = input?.value.trim();
        if (!query) return;
        
        // Add user message to chat
        this.addAIMessage('user', query);
        input.value = '';
        
        // Show typing indicator
        this.showAITyping();
        
        // Simulate thinking delay
        setTimeout(() => {
            const response = this.generateAIResponse(query);
            this.hideAITyping();
            this.addAIMessage('assistant', response);
        }, 500);
    }

    generateAIResponse(query) {
        const q = query.toLowerCase();
        const ctx = this.aiContext;
        
        // Status query
        if (q.includes('status') || q.includes('health') || q.includes('how is') || q === 'status?') {
            return this.generateStatusReport();
        }
        
        // CPU query
        if (q.includes('cpu') || q.includes('processor')) {
            if (ctx.services.mikrotik.connected && ctx.services.mikrotik.cpu !== undefined) {
                const cpu = ctx.services.mikrotik.cpu;
                const status = cpu < 50 ? 'healthy' : cpu < 80 ? 'elevated' : 'critical';
                return `📊 **MikroTik CPU:** ${cpu}%\n\nThis is considered ${status}. ${cpu < 70 ? 'System is operating normally.' : 'Consider investigating processes or upgrading hardware if this persists.'}`;
            }
            return "⚠️ MikroTik service is not connected. Please enable it in the dashboard to get CPU information.";
        }
        
        // ONU/Signal query
        if (q.includes('onu') || q.includes('signal') || q.includes('olt') || q.includes('fiber')) {
            if (ctx.services.olt.connected) {
                const warnings = ctx.services.olt.signalWarnings;
                const total = ctx.services.olt.totalOnus;
                const online = ctx.services.olt.onlineOnus;
                
                if (warnings > 0) {
                    return `🔔 **ONU Signal Analysis:**\n\nFound ${warnings} ONU(s) with low signal strength (below -27dBm).\n\n📊 Statistics:\n• Total ONUs: ${total}\n• Online: ${online}\n• With warnings: ${warnings}\n\n💡 Recommendation: Check fiber connections, splitters, and ONT placement for affected customers.`;
                } else {
                    return `✅ **ONU Signal Status:**\n\nAll ONU signals are within normal range.\n\n📊 Statistics:\n• Total ONUs: ${total}\n• Online: ${online}\n• Signal warnings: 0\n\nNetwork is stable.`;
                }
            }
            return "⚠️ OLT service is not connected. Please enable it in the dashboard to get ONU signal information.";
        }
        
        // Bandwidth query
        if (q.includes('bandwidth') || q.includes('speed') || q.includes('traffic') || q.includes('usage')) {
            if (ctx.services.mikrotik.connected && ctx.services.mikrotik.bandwidth) {
                const bw = ctx.services.mikrotik.bandwidth;
                const total = (bw.download || 0) + (bw.upload || 0);
                const loadStatus = total > 100 ? 'high' : total > 50 ? 'moderate' : 'normal';
                return `📡 **Bandwidth Usage:**\n\n⬇️ Download: ${(bw.download || 0).toFixed(1)} Mbps\n⬆️ Upload: ${(bw.upload || 0).toFixed(1)} Mbps\n📊 Total: ${total.toFixed(1)} Mbps\n\nNetwork load is ${loadStatus}. ${total > 80 ? 'Consider upgrading bandwidth if this persists.' : 'Utilization is within normal range.'}`;
            }
            return "⚠️ MikroTik service is not connected. Please enable it to see bandwidth information.";
        }
        
        // Users query
        if (q.includes('user') || q.includes('active') || q.includes('connected')) {
            if (ctx.services.mikrotik.connected) {
                const active = ctx.services.mikrotik.activeUsers || 0;
                return `👥 **Active Users:**\n\nCurrently ${active} active ${active === 1 ? 'user is' : 'users are'} connected via PPPoE/Hotspot.\n\n${active > 0 ? 'Network is serving customers normally.' : 'No active users at the moment.'}`;
            }
            return "⚠️ MikroTik service is not connected. Please enable it to see active users.";
        }
        
        // Summary query
        if (q.includes('summary') || q.includes('overview') || q.includes('report')) {
            return this.generateSummary();
        }
        
        // Help query
        if (q.includes('help') || q.includes('what can you') || q.includes('commands')) {
            return this.generateHelpMessage();
        }
        
        // Default response with suggestions
        return this.generateDefaultResponse();
    }

    generateStatusReport() {
        const ctx = this.aiContext;
        const issues = [];
        const good = [];
        
        // Check MikroTik
        if (ctx.services.mikrotik.connected) {
            const cpu = ctx.services.mikrotik.cpu;
            if (cpu > 80) issues.push(`⚠️ MikroTik CPU is high at ${cpu}%`);
            else if (cpu > 60) issues.push(`📈 MikroTik CPU is elevated at ${cpu}%`);
            else good.push(`✅ MikroTik CPU is stable at ${cpu}%`);
            
            const bw = ctx.services.mikrotik.bandwidth;
            if (bw && (bw.download + bw.upload) > 80) {
                issues.push(`📊 Bandwidth is high at ${(bw.download + bw.upload).toFixed(0)} Mbps total`);
            }
        } else if (ctx.services.mikrotik.enabled) {
            issues.push("🔌 MikroTik service is disconnected");
        }
        
        // Check OLT
        if (ctx.services.olt.connected) {
            const warnings = ctx.services.olt.signalWarnings;
            if (warnings > 0) {
                issues.push(`🔔 ${warnings} ONU(s) have low signal warnings`);
            } else {
                good.push(`✅ All ONU signals are normal (${ctx.services.olt.onlineOnus}/${ctx.services.olt.totalOnus} online)`);
            }
        } else if (ctx.services.olt.enabled) {
            issues.push("🔌 OLT service is disconnected");
        }
        
        // Check integrations
        if (ctx.services.github.connected) {
            good.push(`✅ GitHub sync is active (${ctx.services.github.latency}ms latency)`);
        } else if (ctx.services.github.enabled) {
            issues.push("🔌 GitHub service is disconnected");
        }
        
        if (ctx.services.telegram.connected) {
            good.push(`✅ Telegram bot is online (${ctx.services.telegram.messages || 0} messages today)`);
        } else if (ctx.services.telegram.enabled) {
            issues.push("🔌 Telegram service is disconnected");
        }
        
        // Build report
        let report = "🏥 **System Health Report**\n\n";
        
        if (issues.length > 0) {
            report += "⚠️ **Issues Detected:**\n";
            issues.forEach(issue => {
                report += `${issue}\n`;
            });
            report += "\n";
        }
        
        if (good.length > 0) {
            report += "✅ **Healthy Components:**\n";
            good.forEach(item => {
                report += `${item}\n`;
            });
            report += "\n";
        }
        
        // Add active users count
        if (ctx.services.mikrotik.connected) {
            const activeUsers = ctx.services.mikrotik.activeUsers;
            report += `👥 **Active Users:** ${activeUsers}\n`;
        }
        
        report += `\n🕐 Last update: ${ctx.lastUpdate}`;
        
        if (issues.length === 0) {
            report += "\n\n🎉 Everything looks stable!";
        } else {
            report += "\n\n💡 Consider investigating the issues above for optimal performance.";
        }
        
        return report;
    }

    generateSummary() {
        const ctx = this.aiContext;
        
        let summary = "📋 **Network Summary Report**\n\n";
        
        summary += "**🖥️ MikroTik Router:**\n";
        if (ctx.services.mikrotik.connected) {
            summary += `• CPU: ${ctx.services.mikrotik.cpu}%\n`;
            summary += `• RAM: ${ctx.services.mikrotik.ram}%\n`;
            summary += `• Uptime: ${ctx.services.mikrotik.uptime}\n`;
            summary += `• Active Users: ${ctx.services.mikrotik.activeUsers}\n`;
            if (ctx.services.mikrotik.bandwidth) {
                summary += `• Bandwidth: ↓${ctx.services.mikrotik.bandwidth.download?.toFixed(1)} ↑${ctx.services.mikrotik.bandwidth.upload?.toFixed(1)} Mbps\n`;
            }
        } else {
            summary += `• Status: ${ctx.services.mikrotik.enabled ? 'Disconnected' : 'Disabled'}\n`;
        }
        
        summary += "\n**🔧 OLT Network:**\n";
        if (ctx.services.olt.connected) {
            summary += `• Total ONUs: ${ctx.services.olt.totalOnus}\n`;
            summary += `• Online ONUs: ${ctx.services.olt.onlineOnus}\n`;
            summary += `• Signal Warnings: ${ctx.services.olt.signalWarnings}\n`;
            const onlinePercent = ctx.services.olt.totalOnus > 0 
                ? ((ctx.services.olt.onlineOnus / ctx.services.olt.totalOnus) * 100).toFixed(1)
                : 0;
            summary += `• Online Rate: ${onlinePercent}%\n`;
        } else {
            summary += `• Status: ${ctx.services.olt.enabled ? 'Disconnected' : 'Disabled'}\n`;
        }
        
        summary += "\n**🔌 Integration Services:**\n";
        summary += `• GitHub API: ${ctx.services.github.connected ? '✅ Connected' : (ctx.services.github.enabled ? '❌ Disconnected' : '⭕ Disabled')}\n`;
        summary += `• Telegram Bot: ${ctx.services.telegram.connected ? '✅ Connected' : (ctx.services.telegram.enabled ? '❌ Disconnected' : '⭕ Disabled')}\n`;
        
        summary += `\n**⚙️ System:** Auto-refresh ${ctx.autoRefresh ? 'ON' : 'OFF'}`;
        summary += `\n🕐 Report generated: ${ctx.lastUpdate}`;
        
        return summary;
    }

    generateHelpMessage() {
        return `🤖 **Nano AI Assistant Help**

I can help you monitor your network! Try asking:

**General Queries:**
• "status" or "health" - Overall system health report
• "summary" or "overview" - Complete network summary
• "help" - Show this help message

**Network Monitoring:**
• "cpu" - MikroTik processor usage
• "onu" or "signal" - Fiber signal quality and warnings
• "bandwidth" or "speed" - Current network traffic
• "users" or "active" - Connected customers count

**Examples:**
• "What's the CPU usage?"
• "Show me ONU signal status"
• "How many users are online?"
• "Network summary please"

💡 Tip: Be specific for better results!`;
    }

    generateDefaultResponse() {
        return `🤔 I'm not sure I understand. I can help with network monitoring questions like:

• "status" - Check overall system health
• "cpu" - View MikroTik CPU usage
• "onu signals" - Check fiber signal quality
• "bandwidth" - See current network traffic
• "active users" - Count connected customers

What would you like to know about your network?`;
    }

    addAIMessage(type, content) {
        const container = document.getElementById('aiMessagesContainer');
        if (!container) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        let icon = 'fas fa-robot';
        if (type === 'user') icon = 'fas fa-user';
        if (type === 'system') icon = 'fas fa-info-circle';
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="${icon}"></i>
                <span>${this.formatAIMessage(content)}</span>
            </div>
        `;
        
        container.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        // Limit messages to 50
        while (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }

    formatAIMessage(content) {
        // Convert markdown-like syntax to HTML
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/•/g, '•');
        return formatted;
    }

    showAITyping() {
        const container = document.getElementById('aiMessagesContainer');
        if (!container) return;
        
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'ai-message assistant typing';
        this.typingIndicator.innerHTML = `
            <div class="message-content">
                <i class="fas fa-robot"></i>
                <span>Analyzing<span class="typing-dots">...</span></span>
            </div>
        `;
        container.appendChild(this.typingIndicator);
        this.typingIndicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    hideAITyping() {
        if (this.typingIndicator) {
            this.typingIndicator.remove();
            this.typingIndicator = null;
        }
    }

    toggleAIWidget() {
        if (this.aiWidget) {
            this.aiWidget.classList.toggle('minimized');
        }
    }

    showAIWidget() {
        if (this.aiWidget) {
            this.aiWidget.style.display = 'flex';
            if (this.aiToggleBtn) this.aiToggleBtn.style.display = 'none';
            localStorage.setItem('aiWidgetHidden', 'false');
        }
    }

    hideAIWidget() {
        if (this.aiWidget) {
            this.aiWidget.style.display = 'none';
            if (this.aiToggleBtn) this.aiToggleBtn.style.display = 'flex';
            localStorage.setItem('aiWidgetHidden', 'true');
        }
    }

    // ============================================================================
    // Data Simulation Methods (Replace with actual API calls)
    // ============================================================================

    async getCredentials(service) {
        const saved = localStorage.getItem('ispSettings');
        if (!saved) return null;
        
        try {
            const settings = await this.decryptData(saved);
            switch(service) {
                case 'github': return settings.githubToken ? { token: settings.githubToken } : null;
                case 'telegram': return settings.telegramToken ? { token: settings.telegramToken, adminId: settings.adminChatId } : null;
                case 'mikrotik': return settings.mikrotikIp ? { ip: settings.mikrotikIp, port: settings.mikrotikPort, user: settings.mikrotikUser, password: settings.mikrotikPass } : null;
                case 'olt': return settings.oltIp ? { ip: settings.oltIp, community: settings.oltCommunity, version: settings.snmpVersion } : null;
                default: return null;
            }
        } catch (e) {
            return null;
        }
    }

    async testConnection(service, credentials) {
        // Simulate connection test
        return new Promise(resolve => {
            setTimeout(() => resolve(true), 500);
        });
    }

    async fetchGitHubData(creds) {
        return {
            latency: Math.floor(Math.random() * 150) + 50,
            lastSync: new Date().toLocaleTimeString()
        };
    }

    async fetchTelegramData(creds) {
        return {
            messagesToday: Math.floor(Math.random() * 500),
            lastMessage: new Date().toLocaleTimeString()
        };
    }

    async fetchMikroTikData(creds) {
        const cpu = Math.floor(Math.random() * 60) + 10;
        const ram = Math.floor(Math.random() * 50) + 20;
        
        return {
            cpu: cpu,
            ram: ram,
            uptime: `${Math.floor(Math.random() * 30) + 1}d ${Math.floor(Math.random() * 24)}h`,
            users: this.generateMockUsers(),
            bandwidth: {
                download: Math.random() * 100,
                upload: Math.random() * 50
            }
        };
    }

    async fetchOLTData(creds) {
        const totalOnus = Math.floor(Math.random() * 200) + 100;
        const onlineOnus = Math.floor(Math.random() * (totalOnus - 10)) + 90;
        const warnings = Math.floor(Math.random() * 15);
        
        const onus = [];
        for (let i = 1; i <= Math.min(20, totalOnus); i++) {
            const rxPower = Math.random() * 10 - 30;
            onus.push({
                id: i,
                serial: `BDCOM-${String(i).padStart(3, '0')}`,
                rxPower: parseFloat(rxPower.toFixed(1)),
                txPower: parseFloat((Math.random() * 3 + 1).toFixed(1)),
                status: rxPower > -27 ? 'online' : 'warning',
                quality: rxPower > -20 ? 'excellent' : rxPower > -27 ? 'good' : 'poor'
            });
        }
        
        return {
            totalOnus: totalOnus,
            onlineOnus: onlineOnus,
            signalWarnings: warnings,
            onus: onus
        };
    }

    generateMockUsers() {
        const count = Math.floor(Math.random() * 20) + 5;
        const users = [];
        for (let i = 1; i <= count; i++) {
            users.push({
                username: `user${String(i).padStart(3, '0')}`,
                address: `192.168.1.${100 + i}`,
                uptime: `${Math.floor(Math.random() * 12)}h ${Math.floor(Math.random() * 60)}m`,
                bytesIn: Math.random() * 500000000,
                bytesOut: Math.random() * 250000000
            });
        }
        return users;
    }

    async manualScanONUs() {
        if (!this.services.olt.connected) {
            this.addLog('Cannot scan ONUs: OLT service not connected');
            alert('Please enable and connect OLT service first');
            return;
        }
        
        this.addLog('Manual ONU scan initiated');
        await this.fetchServiceData('olt');
        this.addLog('ONU scan completed');
    }

    async scanRepositories() {
        const token = document.getElementById('githubToken')?.value;
        if (!token) {
            alert('Please enter GitHub token first');
            return;
        }
        
        this.addLog('Scanning GitHub repositories...');
        
        // Simulate repository scanning
        setTimeout(() => {
            const repos = [
                { full_name: 'unique-network/isp-dashboard' },
                { full_name: 'unique-network/bot-engine' },
                { full_name: 'unique-network/network-stats' }
            ];
            
            const repoSelect = document.getElementById('repoSelect');
            if (repoSelect) {
                repoSelect.innerHTML = '<option value="">Select a repository</option>';
                repos.forEach(repo => {
                    const option = document.createElement('option');
                    option.value = repo.full_name;
                    option.textContent = repo.full_name;
                    repoSelect.appendChild(option);
                });
            }
            
            this.addLog(`Found ${repos.length} repositories`);
        }, 1000);
    }

    async saveCredentials() {
        const settings = {
            githubToken: document.getElementById('githubToken')?.value || '',
            telegramToken: document.getElementById('telegramToken')?.value || '',
            adminChatId: document.getElementById('adminChatId')?.value || '',
            mikrotikIp: document.getElementById('mikrotikIp')?.value || '',
            mikrotikPort: document.getElementById('mikrotikPort')?.value || '',
            mikrotikUser: document.getElementById('mikrotikUser')?.value || '',
            mikrotikPass: document.getElementById('mikrotikPass')?.value || '',
            oltIp: document.getElementById('oltIp')?.value || '',
            oltCommunity: document.getElementById('oltCommunity')?.value || '',
            snmpVersion: document.getElementById('snmpVersion')?.value || '2c'
        };
        
        try {
            const encrypted = await this.encryptData(settings);
            localStorage.setItem('ispSettings', encrypted);
            this.addLog('Credentials saved successfully');
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save credentials:', error);
            alert('Failed to save settings');
        }
    }

    async loadCredentials() {
        const saved = localStorage.getItem('ispSettings');
        if (saved) {
            try {
                const settings = await this.decryptData(saved);
                this.applySettingsToForm(settings);
                this.addLog('Credentials loaded');
            } catch (e) {
                console.error('Failed to decrypt credentials:', e);
            }
        }
    }

    applySettingsToForm(settings) {
        const fields = ['githubToken', 'telegramToken', 'adminChatId', 'mikrotikIp', 
                        'mikrotikPort', 'mikrotikUser', 'mikrotikPass', 'oltIp', 
                        'oltCommunity', 'snmpVersion'];
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && settings[field]) {
                element.value = settings[field];
            }
        });
    }

    async testConnections() {
        this.addLog('Testing all enabled connections...');
        
        for (const service of ['github', 'telegram', 'mikrotik', 'olt']) {
            if (this.services[service].enabled) {
                this.addLog(`Testing ${service}...`);
                if (this.services[service].connected) {
                    await this.fetchServiceData(service);
                    this.addLog(`✓ ${service} test successful`);
                } else {
                    this.addLog(`✗ ${service} is disconnected`);
                }
            }
        }
        
        alert('Connection tests completed. Check logs for details.');
    }

    getDefaultData(service) {
        const defaults = {
            github: { latency: null, lastSync: null },
            telegram: { messagesToday: 0, lastMessage: null },
            mikrotik: { cpu: 0, ram: 0, uptime: '--', users: [], bandwidth: { download: 0, upload: 0 } },
            olt: { totalOnus: 0, onlineOnus: 0, signalWarnings: 0, onus: [] }
        };
        return defaults[service];
    }

    async encryptData(data) {
        const jsonStr = JSON.stringify(data);
        // Simple base64 encoding for demo (use proper encryption in production)
        return btoa(jsonStr);
    }

    async decryptData(encrypted) {
        const jsonStr = atob(encrypted);
        return JSON.parse(jsonStr);
    }

    setupTabNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabs = document.querySelectorAll('.tab-content');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = item.dataset.tab;
                
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                tabs.forEach(tab => tab.classList.remove('active'));
                const targetTab = document.getElementById(`${tabId}Tab`);
                if (targetTab) targetTab.classList.add('active');
                
                const titleSpan = item.querySelector('span');
                if (titleSpan) {
                    const pageTitle = document.getElementById('pageTitle');
                    if (pageTitle) pageTitle.textContent = titleSpan.textContent;
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addLog(message) {
        const logsList = document.getElementById('logsList');
        if (!logsList) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${this.escapeHtml(message)}`;
        logsList.insertBefore(logEntry, logsList.firstChild);
        
        while (logsList.children.length > 100) {
            logsList.removeChild(logsList.lastChild);
        }
    }
}

// Initialize on page load
let systemMonitor;
document.addEventListener('DOMContentLoaded', () => {
    systemMonitor = new SystemHealthMonitor();
});
