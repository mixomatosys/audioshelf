// AudioShelf - Renderer Process (Frontend Logic)

const Scanner = require('./scanner');
const Database = require('./database');

class AudioShelfApp {
  constructor() {
    this.scanner = new Scanner();
    this.database = new Database();
    this.plugins = [];
    
    this.initializeUI();
  }

  initializeUI() {
    // Get DOM elements
    this.scanButton = document.getElementById('scanButton');
    this.statusText = document.getElementById('statusText');
    this.pluginContainer = document.getElementById('pluginContainer');
    this.totalCount = document.getElementById('totalCount');
    this.vstCount = document.getElementById('vstCount');
    this.vst3Count = document.getElementById('vst3Count');
    this.auCount = document.getElementById('auCount');

    // Bind events
    this.scanButton.addEventListener('click', () => this.scanPlugins());

    // Load existing plugins
    this.loadPlugins();
  }

  async loadPlugins() {
    try {
      this.plugins = await this.database.loadPlugins();
      this.updateUI();
      this.updateStatus('Loaded existing plugin data');
    } catch (error) {
      console.warn('No existing plugin data found:', error.message);
      this.updateStatus('No existing plugin data');
    }
  }

  async scanPlugins() {
    this.scanButton.disabled = true;
    this.scanButton.textContent = '🔍 Scanning...';
    this.updateStatus('Scanning for plugins...');
    
    try {
      // Show loading state
      this.pluginContainer.innerHTML = `
        <div class="loading">
          <h3>Scanning your system for plugins</h3>
          <p>This may take a few moments</p>
        </div>
      `;

      // Perform the scan
      const foundPlugins = await this.scanner.scanAll();
      
      // Save to database
      await this.database.savePlugins(foundPlugins);
      
      // Update local state
      this.plugins = foundPlugins;
      
      // Update UI
      this.updateUI();
      this.updateStatus(`Found ${foundPlugins.length} plugins`);
      
    } catch (error) {
      console.error('Scan failed:', error);
      this.updateStatus(`Scan failed: ${error.message}`);
      this.showError('Failed to scan plugins. Check console for details.');
    } finally {
      this.scanButton.disabled = false;
      this.scanButton.textContent = '🔍 Scan Plugins';
    }
  }

  updateUI() {
    // Update statistics
    this.totalCount.textContent = this.plugins.length;
    this.vstCount.textContent = this.plugins.filter(p => p.format === 'VST').length;
    this.vst3Count.textContent = this.plugins.filter(p => p.format === 'VST3').length;
    this.auCount.textContent = this.plugins.filter(p => p.format === 'AU').length;

    // Update plugin list
    if (this.plugins.length === 0) {
      this.pluginContainer.innerHTML = `
        <div class="empty-state">
          <h3>No plugins found</h3>
          <p>Try scanning for plugins or check your plugin directories</p>
        </div>
      `;
    } else {
      this.renderPluginList();
    }
  }

  renderPluginList() {
    const pluginHTML = this.plugins.map(plugin => `
      <div class="plugin-item">
        <div class="plugin-name">${plugin.name}</div>
        <div class="plugin-info">
          ${plugin.vendor || 'Unknown Vendor'} • 
          ${plugin.format} • 
          v${plugin.version || '?'} • 
          <span style="color: ${plugin.installed ? '#4CAF50' : '#f44336'}">
            ${plugin.installed ? '✅ Installed' : '❌ Missing'}
          </span>
        </div>
      </div>
    `).join('');

    this.pluginContainer.innerHTML = pluginHTML;
  }

  updateStatus(message) {
    this.statusText.textContent = message;
    console.log('[AudioShelf]', message);
  }

  showError(message) {
    this.pluginContainer.innerHTML = `
      <div class="empty-state" style="color: #f44336;">
        <h3>⚠️ Error</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AudioShelfApp();
});

// Handle app focus/blur for potential future features
window.addEventListener('focus', () => {
  console.log('App focused');
});

window.addEventListener('blur', () => {
  console.log('App blurred');
});