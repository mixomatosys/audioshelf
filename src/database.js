// AudioShelf - Database Module (JSON file storage)

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class Database {
  constructor() {
    this.dataDir = this.getDataDirectory();
    this.pluginsFile = path.join(this.dataDir, 'plugins.json');
    this.metadataFile = path.join(this.dataDir, 'metadata.json');
  }

  getDataDirectory() {
    // Store data in the user's home directory
    const homeDir = os.homedir();
    const appDataDir = path.join(homeDir, '.audioshelf');
    return appDataDir;
  }

  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch (error) {
      console.log('[Database] Creating data directory:', this.dataDir);
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async savePlugins(plugins) {
    try {
      await this.ensureDataDirectory();
      
      const data = {
        plugins: plugins,
        metadata: {
          lastScan: new Date().toISOString(),
          platform: os.platform(),
          hostname: os.hostname(),
          totalPlugins: plugins.length,
          pluginCounts: {
            vst: plugins.filter(p => p.format === 'VST').length,
            vst3: plugins.filter(p => p.format === 'VST3').length,
            au: plugins.filter(p => p.format === 'AU').length
          }
        }
      };

      await fs.writeFile(this.pluginsFile, JSON.stringify(data, null, 2));
      console.log(`[Database] Saved ${plugins.length} plugins to ${this.pluginsFile}`);
      
      return data;
    } catch (error) {
      console.error('[Database] Failed to save plugins:', error);
      throw error;
    }
  }

  async loadPlugins() {
    try {
      const fileContent = await fs.readFile(this.pluginsFile, 'utf8');
      const data = JSON.parse(fileContent);
      
      console.log(`[Database] Loaded ${data.plugins.length} plugins from ${this.pluginsFile}`);
      
      // Verify plugins still exist on disk
      const verifiedPlugins = await this.verifyPlugins(data.plugins);
      
      return verifiedPlugins;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[Database] No existing plugin database found');
        return [];
      } else {
        console.error('[Database] Failed to load plugins:', error);
        throw error;
      }
    }
  }

  async verifyPlugins(plugins) {
    console.log('[Database] Verifying plugin files still exist...');
    const verified = [];

    for (const plugin of plugins) {
      try {
        await fs.access(plugin.path);
        plugin.installed = true;
        verified.push(plugin);
      } catch (error) {
        console.warn(`[Database] Plugin no longer exists: ${plugin.name} at ${plugin.path}`);
        plugin.installed = false;
        verified.push(plugin); // Keep in database but mark as missing
      }
    }

    const installedCount = verified.filter(p => p.installed).length;
    const missingCount = verified.filter(p => !p.installed).length;
    
    console.log(`[Database] Verification complete: ${installedCount} installed, ${missingCount} missing`);
    
    return verified;
  }

  async getMetadata() {
    try {
      const fileContent = await fs.readFile(this.pluginsFile, 'utf8');
      const data = JSON.parse(fileContent);
      return data.metadata || {};
    } catch (error) {
      console.warn('[Database] No metadata found:', error.message);
      return {};
    }
  }

  async exportPlugins(exportPath) {
    try {
      const plugins = await this.loadPlugins();
      const exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: 'AudioShelf',
        platform: os.platform(),
        hostname: os.hostname(),
        plugins: plugins
      };

      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
      console.log(`[Database] Exported ${plugins.length} plugins to ${exportPath}`);
      
      return exportData;
    } catch (error) {
      console.error('[Database] Export failed:', error);
      throw error;
    }
  }

  async importPlugins(importPath) {
    try {
      const fileContent = await fs.readFile(importPath, 'utf8');
      const importData = JSON.parse(fileContent);
      
      if (!importData.plugins || !Array.isArray(importData.plugins)) {
        throw new Error('Invalid import file format');
      }

      // Merge with existing plugins (avoid duplicates)
      const existingPlugins = await this.loadPlugins();
      const existingIds = new Set(existingPlugins.map(p => p.id));
      
      const newPlugins = importData.plugins.filter(p => !existingIds.has(p.id));
      const mergedPlugins = [...existingPlugins, ...newPlugins];

      await this.savePlugins(mergedPlugins);
      
      console.log(`[Database] Imported ${newPlugins.length} new plugins from ${importPath}`);
      return mergedPlugins;
    } catch (error) {
      console.error('[Database] Import failed:', error);
      throw error;
    }
  }

  async deleteDatabase() {
    try {
      await fs.unlink(this.pluginsFile);
      console.log('[Database] Plugin database deleted');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Database] Failed to delete database:', error);
        throw error;
      }
    }
  }

  async getStats() {
    try {
      const plugins = await this.loadPlugins();
      const metadata = await this.getMetadata();
      
      const stats = {
        totalPlugins: plugins.length,
        installedPlugins: plugins.filter(p => p.installed).length,
        missingPlugins: plugins.filter(p => !p.installed).length,
        formats: {
          vst: plugins.filter(p => p.format === 'VST').length,
          vst3: plugins.filter(p => p.format === 'VST3').length,
          au: plugins.filter(p => p.format === 'AU').length
        },
        categories: {},
        lastScan: metadata.lastScan || null,
        platform: metadata.platform || os.platform()
      };

      // Count plugins by category
      plugins.forEach(plugin => {
        const category = plugin.category || 'Other';
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('[Database] Failed to get stats:', error);
      return null;
    }
  }
}

module.exports = Database;