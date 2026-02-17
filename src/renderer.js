// AudioShelf - Renderer Process (Frontend Logic)

const path = require('path');
const Scanner = require(path.join(process.cwd(), 'src', 'scanner.js'));
const Database = require(path.join(process.cwd(), 'src', 'database.js'));
const AbletonScanner = require(path.join(process.cwd(), 'src', 'ableton-scanner.js'));

class AudioShelfApp {
  constructor() {
    this.scanner = new Scanner();
    this.database = new Database();
    this.abletonScanner = new AbletonScanner();
    this.plugins = [];
    
    this.initializeUI();
  }

  initializeUI() {
    // Get DOM elements
    this.scanButton = document.getElementById('scanButton');
    // this.scanAbletonButton = document.getElementById('scanAbletonButton');
    this.exportButton = document.getElementById('exportButton');
    this.statusText = document.getElementById('statusText');
    this.pluginContainer = document.getElementById('pluginContainer');
    this.totalCount = document.getElementById('totalCount');
    this.visibleCount = document.getElementById('visibleCount');
    this.vstCount = document.getElementById('vstCount');
    this.vst3Count = document.getElementById('vst3Count');
    this.auCount = document.getElementById('auCount');
    
    // Filter elements
    this.vendorFilter = document.getElementById('vendorFilter');
    this.formatFilter = document.getElementById('formatFilter');
    this.categoryFilter = document.getElementById('categoryFilter');
    this.searchFilter = document.getElementById('searchFilter');
    this.clearFilters = document.getElementById('clearFilters');

    // Bind events
    this.scanButton.addEventListener('click', () => this.scanPlugins());
    // this.scanAbletonButton.addEventListener('click', () => this.scanAbletonProjects());
    this.exportButton.addEventListener('click', () => this.exportPluginList());
    
    // Filter events
    this.vendorFilter.addEventListener('change', () => this.applyFilters());
    this.formatFilter.addEventListener('change', () => this.applyFilters());
    this.categoryFilter.addEventListener('change', () => this.applyFilters());
    this.searchFilter.addEventListener('input', () => this.applyFilters());
    this.clearFilters.addEventListener('click', () => this.clearAllFilters());

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
    // Populate filter dropdowns
    this.populateFilters();
    
    // Apply current filters and update display
    this.applyFilters();
  }

  populateFilters() {
    if (!this.plugins || this.plugins.length === 0) return;
    
    // Get unique values for filters
    const vendors = [...new Set(this.plugins.map(p => p.vendor).filter(v => v && v !== 'Unknown' && !v.includes('.vst')))].sort();
    const categories = [...new Set(this.plugins.map(p => p.subcategory || p.category).filter(c => c))].sort();
    
    // Populate vendor filter
    this.vendorFilter.innerHTML = '<option value="">All Vendors</option>';
    vendors.forEach(vendor => {
      this.vendorFilter.innerHTML += `<option value="${vendor}">${vendor}</option>`;
    });
    
    // Populate category filter
    this.categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
      this.categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
    });
  }

  getFilteredPlugins() {
    let filtered = [...this.plugins];
    
    // Apply vendor filter
    const vendorValue = this.vendorFilter.value;
    if (vendorValue) {
      filtered = filtered.filter(p => p.vendor === vendorValue);
    }
    
    // Apply format filter
    const formatValue = this.formatFilter.value;
    if (formatValue) {
      filtered = filtered.filter(p => 
        p.formats && p.formats.some(f => f.format === formatValue)
      );
    }
    
    // Apply category filter
    const categoryValue = this.categoryFilter.value;
    if (categoryValue) {
      filtered = filtered.filter(p => 
        (p.subcategory || p.category) === categoryValue
      );
    }
    
    // Apply search filter
    const searchValue = this.searchFilter.value.toLowerCase();
    if (searchValue) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchValue) ||
        (p.vendor && p.vendor.toLowerCase().includes(searchValue)) ||
        (p.description && p.description.toLowerCase().includes(searchValue))
      );
    }
    
    return filtered;
  }

  applyFilters() {
    const filteredPlugins = this.getFilteredPlugins();
    
    // Update statistics
    this.updateStatistics(filteredPlugins);
    
    // Update plugin list
    if (filteredPlugins.length === 0) {
      this.pluginContainer.innerHTML = `
        <div class="empty-state">
          <h3>🔍 No Plugins Match Filters</h3>
          <p>Try adjusting your filter criteria or <button onclick="document.querySelector('#clearFilters').click()" style="color: #4CAF50; background: none; border: none; cursor: pointer; text-decoration: underline;">clearing all filters</button></p>
        </div>
      `;
    } else {
      this.renderPluginList(filteredPlugins);
    }
  }

  updateStatistics(filteredPlugins = null) {
    const pluginsToCount = filteredPlugins || this.plugins;
    
    // Calculate statistics
    let vstCount = 0, vst3Count = 0, auCount = 0;
    
    pluginsToCount.forEach(plugin => {
      plugin.formats.forEach(format => {
        switch(format.format) {
          case 'VST': vstCount++; break;
          case 'VST3': vst3Count++; break;
          case 'AU': auCount++; break;
        }
      });
    });

    this.totalCount.textContent = this.plugins.length;
    this.visibleCount.textContent = pluginsToCount.length;
    this.vstCount.textContent = vstCount;
    this.vst3Count.textContent = vst3Count;
    this.auCount.textContent = auCount;
  }

  clearAllFilters() {
    this.vendorFilter.value = '';
    this.formatFilter.value = '';
    this.categoryFilter.value = '';
    this.searchFilter.value = '';
    this.applyFilters();
  }

  renderPluginList(pluginsToRender = null) {
    const plugins = pluginsToRender || this.plugins;
    const pluginHTML = plugins.map(plugin => {
      // Create format badges
      const formatBadges = plugin.formats.map(format => {
        const badgeColor = this.getFormatColor(format.format);
        return `<span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 4px;">${format.format}</span>`;
      }).join('');

      // Determine overall install status
      const allInstalled = plugin.formats.every(f => plugin.installed);
      const statusColor = allInstalled ? '#4CAF50' : '#f44336';
      const statusText = allInstalled ? '✅ Installed' : '❌ Missing';

      // Add demo indicator
      const demoIndicator = plugin.isDemo ? '<span style="background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 4px;">DEMO</span>' : '';
      
      // Enhanced category display
      const categoryText = plugin.subcategory ? `${plugin.subcategory}` : plugin.category;
      
      // Version display (only show if we have a real version)
      const versionDisplay = plugin.version && plugin.version !== '?' ? `v${plugin.version} • ` : '';
      
      // Tags display
      const tagsDisplay = plugin.tags && plugin.tags.length > 0 ? 
        `<div style="margin-top: 4px; font-size: 0.75em; opacity: 0.8;">
          ${plugin.tags.slice(0, 3).map(tag => `<span style="background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 2px; margin-right: 4px;">${tag}</span>`).join('')}
        </div>` : '';
      
      // Description display  
      const descriptionDisplay = plugin.description && plugin.description !== `${plugin.category || 'Audio plugin'} by ${plugin.vendor || 'Unknown'}` ?
        `<div style="margin-top: 6px; font-size: 0.85em; opacity: 0.9; line-height: 1.3;">
          ${plugin.description}
        </div>` : '';

      return `
        <div class="plugin-item" onclick="app.showPluginDetail('${plugin.id}')" style="cursor: pointer;">
          <div class="plugin-name">${plugin.name}</div>
          <div class="plugin-info">
            ${plugin.vendor || 'Unknown Vendor'} • 
            ${categoryText || 'Other'} • 
            ${formatBadges} • 
            ${demoIndicator}
            ${versionDisplay}
            <span style="color: ${statusColor}">
              ${statusText}
            </span>
          </div>
          ${descriptionDisplay}
          ${tagsDisplay}
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

  async scanAbletonProjects() {
    this.scanAbletonButton.disabled = true;
    this.scanAbletonButton.textContent = '🎵 Scanning...';
    this.updateStatus('Scanning Ableton projects...');
    
    try {
      // Check if we have plugins to work with
      if (!this.plugins || this.plugins.length === 0) {
        throw new Error('Please scan plugins first before scanning Ableton projects');
      }

      // Scan all .als files and extract VST plugin usage
      const projects = await this.abletonScanner.scanAllProjects();
      
      // Save project data to database
      await this.database.saveProjects(projects);
      
      // Link projects to plugins and update plugin data with usage info
      const pluginsWithUsage = await this.database.linkProjectsToPlugins(projects, this.plugins);
      
      // Update plugins in database with usage information
      await this.database.savePlugins(pluginsWithUsage);
      
      // Update local state
      this.plugins = pluginsWithUsage;
      
      // Refresh UI
      this.updateUI();
      this.updateStatus(`Scanned ${projects.length} Ableton projects, linked to ${pluginsWithUsage.filter(p => p.projectUsage && p.projectUsage.length > 0).length} plugins`);
      
    } catch (error) {
      console.error('Ableton scan failed:', error);
      this.updateStatus(`Ableton scan failed: ${error.message}`);
      this.showError('Failed to scan Ableton projects. Check console for details.');
    } finally {
      this.scanAbletonButton.disabled = false;
      this.scanAbletonButton.textContent = '🎵 Scan Ableton Projects';
    }
  }

  showPluginDetail(pluginId) {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      console.error('Plugin not found:', pluginId);
      return;
    }

    // Hide main view, show detail view
    document.querySelector('.main-content').style.display = 'none';
    
    // Create detail view if it doesn't exist
    let detailView = document.getElementById('plugin-detail-view');
    if (!detailView) {
      detailView = document.createElement('div');
      detailView.id = 'plugin-detail-view';
      detailView.className = 'plugin-detail-view';
      document.querySelector('.app-container').appendChild(detailView);
    }

    // Render plugin detail
    this.renderPluginDetail(plugin, detailView);
    detailView.style.display = 'flex';
  }

  renderPluginDetail(plugin, container) {
    // Create format badges
    const formatBadges = plugin.formats.map(format => {
      const badgeColor = this.getFormatColor(format.format);
      return `<span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.9em; margin-right: 8px;">${format.format}</span>`;
    }).join('');

    // Project usage section
    const projectUsageHtml = this.renderProjectUsage(plugin);

    // Enhanced details
    const categoryText = plugin.subcategory ? `${plugin.subcategory}` : plugin.category;
    const versionDisplay = plugin.version && plugin.version !== '?' ? plugin.version : 'Unknown';
    const demoIndicator = plugin.isDemo ? '<span style="background: #FF9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.9em; margin-right: 8px;">DEMO VERSION</span>' : '';
    
    container.innerHTML = `
      <div class="detail-header">
        <button class="back-button" onclick="app.showMainView()">← Back to Plugins</button>
        <h1>${plugin.name}</h1>
      </div>

      <div class="detail-content">
        <div class="detail-sidebar">
          <div class="detail-card">
            <h3>Plugin Information</h3>
            <div class="detail-info">
              <div class="detail-row">
                <span class="detail-label">Vendor:</span>
                <span class="detail-value">${plugin.vendor || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${categoryText || 'Other'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Version:</span>
                <span class="detail-value">${versionDisplay}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Formats:</span>
                <span class="detail-value">${formatBadges}</span>
              </div>
              ${demoIndicator ? `<div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${demoIndicator}</span>
              </div>` : ''}
            </div>
          </div>

          ${plugin.description && plugin.description !== `${plugin.category || 'Audio plugin'} by ${plugin.vendor || 'Unknown'}` ? `
          <div class="detail-card">
            <h3>Description</h3>
            <p>${plugin.description}</p>
          </div>
          ` : ''}

          ${plugin.tags && plugin.tags.length > 0 ? `
          <div class="detail-card">
            <h3>Tags</h3>
            <div class="tags-display">
              ${plugin.tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
            </div>
          </div>
          ` : ''}
        </div>

        <div class="detail-main">
          ${projectUsageHtml}
        </div>
      </div>
    `;
  }

  renderProjectUsage(plugin) {
    if (!plugin.projectUsage || plugin.projectUsage.length === 0) {
      return `
        <div class="detail-card">
          <h3>📁 Used in Ableton Projects</h3>
          <div class="no-usage">
            <p>This plugin is not currently used in any scanned Ableton projects.</p>
            <p style="font-size: 0.9em; opacity: 0.7; margin-top: 10px;">
              <em>Scan Ableton projects to see usage information.</em>
            </p>
          </div>
        </div>
      `;
    }

    const projectsList = plugin.projectUsage.map(usage => {
      const lastModified = new Date(usage.lastModified).toLocaleDateString();
      return `
        <div class="project-item">
          <div class="project-name">${usage.projectName}</div>
          <div class="project-info">
            <span class="project-file">${usage.projectFile}</span>
            <span class="project-date">Modified: ${lastModified}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-card">
        <h3>📁 Used in Ableton Projects (${plugin.projectUsage.length})</h3>
        <div class="projects-list">
          ${projectsList}
        </div>
      </div>
    `;
  }

  showMainView() {
    // Hide detail view, show main view
    const detailView = document.getElementById('plugin-detail-view');
    if (detailView) {
      detailView.style.display = 'none';
    }
    document.querySelector('.main-content').style.display = 'flex';
  }

  exportPluginList() {
    if (!this.plugins || this.plugins.length === 0) {
      alert('No plugins found. Please scan first.');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalPlugins: this.plugins.length,
      withMetadata: this.plugins.filter(p => p.hasMetadata).length,
      needingMetadata: this.plugins.filter(p => p.needsMetadata).length,
      plugins: this.plugins.map(plugin => ({
        name: plugin.name,
        vendor: plugin.vendor || 'Unknown',
        category: plugin.category,
        subcategory: plugin.subcategory,
        formats: plugin.formats ? plugin.formats.map(f => f.format) : [plugin.format],
        isDemo: plugin.isDemo,
        hasMetadata: plugin.hasMetadata,
        description: plugin.description,
        tags: plugin.tags || []
      }))
    };

    // Create downloadable file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `audioshelf-plugins-${new Date().toISOString().split('T')[0]}.json`;
    
    // Auto-download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.updateStatus(`Exported ${this.plugins.length} plugins to JSON file`);
    
    // Also copy to clipboard for easy sharing
    navigator.clipboard.writeText(JSON.stringify(exportData.plugins, null, 2)).then(() => {
      console.log('Plugin list copied to clipboard!');
    }).catch(() => {
      console.log('Could not copy to clipboard, but file was downloaded');
    });
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AudioShelfApp();
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