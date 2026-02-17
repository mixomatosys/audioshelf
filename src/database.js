// AudioShelf - Database Module (JSON file storage)

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class Database {
  constructor() {
    this.dataDir = this.getDataDirectory();
    this.pluginsFile = path.join(this.dataDir, 'plugins.json');
    this.metadataFile = path.join(this.dataDir, 'metadata.json');
    this.projectsFile = path.join(this.dataDir, 'projects.json');
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
            vst: this.countPluginsByFormat(plugins, 'VST'),
            vst3: this.countPluginsByFormat(plugins, 'VST3'),
            au: this.countPluginsByFormat(plugins, 'AU'),
            uniquePlugins: plugins.length
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
      // For consolidated plugins, check each format path
      if (plugin.formats && Array.isArray(plugin.formats)) {
        let anyInstalled = false;
        for (const format of plugin.formats) {
          try {
            await fs.access(format.path);
            format.installed = true;
            anyInstalled = true;
          } catch (error) {
            console.warn(`[Database] Plugin format no longer exists: ${plugin.name} (${format.format}) at ${format.path}`);
            format.installed = false;
          }
        }
        plugin.installed = anyInstalled;
        verified.push(plugin);
      } else {
        // Legacy single-format plugin
        try {
          await fs.access(plugin.path);
          plugin.installed = true;
          verified.push(plugin);
        } catch (error) {
          console.warn(`[Database] Plugin no longer exists: ${plugin.name} at ${plugin.path}`);
          plugin.installed = false;
          verified.push(plugin);
        }
      }
    }

    const installedCount = verified.filter(p => p.installed).length;
    const missingCount = verified.filter(p => !p.installed).length;
    
    console.log(`[Database] Verification complete: ${installedCount} installed, ${missingCount} missing`);
    
    return verified;
  }

  countPluginsByFormat(plugins, targetFormat) {
    let count = 0;
    plugins.forEach(plugin => {
      if (plugin.formats && Array.isArray(plugin.formats)) {
        count += plugin.formats.filter(f => f.format === targetFormat).length;
      } else if (plugin.format === targetFormat) {
        // Legacy single-format support
        count++;
      }
    });
    return count;
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
          vst: this.countPluginsByFormat(plugins, 'VST'),
          vst3: this.countPluginsByFormat(plugins, 'VST3'),
          au: this.countPluginsByFormat(plugins, 'AU')
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

  // Project-related methods for Ableton integration

  async saveProjects(projects) {
    try {
      await this.ensureDataDirectory();
      
      const data = {
        projects: projects,
        metadata: {
          lastScan: new Date().toISOString(),
          totalProjects: projects.length,
          totalPluginReferences: projects.reduce((sum, p) => sum + p.vstPlugins.length, 0)
        }
      };

      await fs.writeFile(this.projectsFile, JSON.stringify(data, null, 2));
      console.log(`[Database] Saved ${projects.length} Ableton projects to ${this.projectsFile}`);
      
      return data;
    } catch (error) {
      console.error('[Database] Failed to save projects:', error);
      throw error;
    }
  }

  async loadProjects() {
    try {
      const fileContent = await fs.readFile(this.projectsFile, 'utf8');
      const data = JSON.parse(fileContent);
      
      console.log(`[Database] Loaded ${data.projects.length} Ableton projects from ${this.projectsFile}`);
      return data.projects;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[Database] No existing project database found');
        return [];
      } else {
        console.error('[Database] Failed to load projects:', error);
        throw error;
      }
    }
  }

  async linkProjectsToPlugins(projects, plugins) {
    // Create a mapping of which projects use which plugins
    const pluginUsage = {};
    
    // Initialize usage tracking for all plugins
    plugins.forEach(plugin => {
      pluginUsage[plugin.id] = [];
    });

    // Process each project
    projects.forEach(project => {
      project.vstPlugins.forEach(abletonPluginName => {
        // Try to match this Ableton plugin name to a plugin in our database
        const matchedPlugin = plugins.find(dbPlugin => 
          dbPlugin.name.toLowerCase() === abletonPluginName.toLowerCase()
        );
        
        if (matchedPlugin) {
          // Add this project to the plugin's usage list
          if (!pluginUsage[matchedPlugin.id]) {
            pluginUsage[matchedPlugin.id] = [];
          }
          
          pluginUsage[matchedPlugin.id].push({
            projectName: project.name,
            projectFile: project.fileName,
            lastModified: project.lastModified
          });
        }
      });
    });

    // Update plugins with usage information
    const pluginsWithUsage = plugins.map(plugin => ({
      ...plugin,
      projectUsage: pluginUsage[plugin.id] || []
    }));

    console.log(`[Database] Linked projects to plugins. Found usage data for ${Object.values(pluginUsage).filter(usage => usage.length > 0).length} plugins`);
    
    return pluginsWithUsage;
  }

  async getPluginUsageStats() {
    try {
      const plugins = await this.loadPlugins();
      const projects = await this.loadProjects();
      
      if (!plugins.length || !projects.length) {
        return null;
      }

      // Calculate usage statistics
      const pluginsWithUsage = plugins.filter(p => p.projectUsage && p.projectUsage.length > 0);
      const unusedPlugins = plugins.filter(p => !p.projectUsage || p.projectUsage.length === 0);
      
      const stats = {
        totalProjects: projects.length,
        pluginsWithUsage: pluginsWithUsage.length,
        unusedPlugins: unusedPlugins.length,
        mostUsedPlugins: pluginsWithUsage
          .sort((a, b) => b.projectUsage.length - a.projectUsage.length)
          .slice(0, 10)
          .map(p => ({
            name: p.name,
            vendor: p.vendor,
            usageCount: p.projectUsage.length
          }))
      };

      return stats;
    } catch (error) {
      console.error('[Database] Failed to get usage stats:', error);
      return null;
    }
  }
}

module.exports = Database;