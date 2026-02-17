// AudioShelf - Renderer Process (Frontend Logic)

const path = require('path');
const Scanner = require(path.join(process.cwd(), 'src', 'scanner.js'));
const Database = require(path.join(process.cwd(), 'src', 'database.js'));

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
    // Update statistics - count total format instances
    let vstCount = 0, vst3Count = 0, auCount = 0;
    
    this.plugins.forEach(plugin => {
      plugin.formats.forEach(format => {
        switch(format.format) {
          case 'VST': vstCount++; break;
          case 'VST3': vst3Count++; break;
          case 'AU': auCount++; break;
        }
      });
    });

    this.totalCount.textContent = this.plugins.length;
    this.vstCount.textContent = vstCount;
    this.vst3Count.textContent = vst3Count;
    this.auCount.textContent = auCount;

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
    const pluginHTML = this.plugins.map(plugin => {
      // Create format badges
      const formatBadges = plugin.formats.map(format => {
        const badgeColor = this.getFormatColor(format.format);
        return `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 4px;">${format.format}</span>`;
      }).join('');

      // Determine overall install status
      const allInstalled = plugin.formats.every(f => plugin.installed);
      const statusColor = allInstalled ? '#4CAF50' : '#f44336';
      const statusText = allInstalled ? '✅ Installed' : '❌ Missing';

      return `
        <div class="plugin-item">
          <div class="plugin-name">${plugin.name}</div>
          <div class="plugin-info">
            ${plugin.vendor || 'Unknown Vendor'} • 
            ${formatBadges} • 
            v${plugin.version || '?'} • 
            <span style="color: ${statusColor}">
              ${statusText}
            </span>
          </div>
        </div>
      `;
    }).join('');

    this.pluginContainer.innerHTML = pluginHTML;
  }

  getFormatColor(format) {
    switch(format) {
      case 'VST': return '#FF6B35';   // Orange
      case 'VST3': return '#4CAF50';  // Green  
      case 'AU': return '#2196F3';    // Blue
      default: return '#757575';      // Gray
    }
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

// Add keyboard shortcuts for scrolling
window.addEventListener('keydown', (event) => {
  const pluginContainer = document.getElementById('pluginContainer');
  
  switch(event.key) {
    case 'ArrowDown':
      event.preventDefault();
      pluginContainer.scrollTop += 100;
      break;
    case 'ArrowUp':
      event.preventDefault();
      pluginContainer.scrollTop -= 100;
      break;
    case 'PageDown':
      event.preventDefault();
      pluginContainer.scrollTop += pluginContainer.clientHeight - 50;
      break;
    case 'PageUp':
      event.preventDefault();
      pluginContainer.scrollTop -= pluginContainer.clientHeight - 50;
      break;
    case 'Home':
      event.preventDefault();
      pluginContainer.scrollTop = 0;
      break;
    case 'End':
      event.preventDefault();
      pluginContainer.scrollTop = pluginContainer.scrollHeight;
      break;
  }
});