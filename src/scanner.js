// AudioShelf - Plugin Scanner Module

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PluginScanner {
  constructor() {
    this.platform = os.platform();
    this.pluginPaths = this.getPluginPaths();
  }

  getPluginPaths() {
    const paths = {
      vst: [],
      vst3: [],
      au: []
    };

    if (this.platform === 'win32') {
      // Windows plugin paths
      const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
      const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
      
      paths.vst = [
        path.join(programFiles, 'VstPlugins'),
        path.join(programFiles, 'Steinberg', 'VstPlugins'),
        path.join(programFilesX86, 'VstPlugins'),
        path.join(programFilesX86, 'Steinberg', 'VstPlugins'),
        'C:\\VstPlugins'
      ];
      
      paths.vst3 = [
        path.join(programFiles, 'Common Files', 'VST3'),
        path.join(programFilesX86, 'Common Files', 'VST3')
      ];
      
    } else if (this.platform === 'darwin') {
      // macOS plugin paths
      const homeDir = os.homedir();
      
      paths.vst = [
        '/Library/Audio/Plug-Ins/VST',
        path.join(homeDir, 'Library/Audio/Plug-Ins/VST')
      ];
      
      paths.vst3 = [
        '/Library/Audio/Plug-Ins/VST3',
        path.join(homeDir, 'Library/Audio/Plug-Ins/VST3')
      ];
      
      paths.au = [
        '/Library/Audio/Plug-Ins/Components',
        path.join(homeDir, 'Library/Audio/Plug-Ins/Components')
      ];
    }

    return paths;
  }

  async scanAll() {
    console.log('[Scanner] Starting plugin scan...');
    const allPlugins = [];

    try {
      // Scan VST plugins (different extensions per platform)
      const vstExtensions = this.platform === 'win32' ? ['.dll', '.vst'] : ['.vst'];
      const vstPlugins = await this.scanPluginType('vst', ...vstExtensions);
      allPlugins.push(...vstPlugins);

      // Scan VST3 plugins
      const vst3Plugins = await this.scanPluginType('vst3', '.vst3');
      allPlugins.push(...vst3Plugins);

      // Scan AU plugins (macOS only)
      if (this.platform === 'darwin') {
        const auPlugins = await this.scanPluginType('au', '.component');
        allPlugins.push(...auPlugins);
      }

      console.log(`[Scanner] Found ${allPlugins.length} plugins total`);
      return allPlugins;

    } catch (error) {
      console.error('[Scanner] Scan failed:', error);
      throw error;
    }
  }

  async scanPluginType(type, ...extensions) {
    const plugins = [];
    const paths = this.pluginPaths[type] || [];

    console.log(`[Scanner] Scanning ${type.toUpperCase()} plugins in ${paths.length} directories`);
    console.log(`[Scanner] Looking for extensions: ${extensions.join(', ')}`);
    console.log(`[Scanner] Directories to scan:`, paths);

    for (const pluginPath of paths) {
      console.log(`[Scanner] Checking directory: ${pluginPath}`);
      try {
        const found = await this.scanDirectory(pluginPath, type.toUpperCase(), extensions);
        plugins.push(...found);
        console.log(`[Scanner] Found ${found.length} plugins in ${pluginPath}`);
      } catch (error) {
        console.warn(`[Scanner] Skipped directory ${pluginPath}: ${error.message}`);
      }
    }

    console.log(`[Scanner] Found ${plugins.length} ${type.toUpperCase()} plugins total`);
    return plugins;
  }

  async scanDirectory(directory, format, extensions) {
    const plugins = [];

    try {
      // Check if directory exists first
      await fs.access(directory);
      
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          try {
            const subPlugins = await this.scanDirectory(fullPath, format, extensions);
            plugins.push(...subPlugins);
          } catch (error) {
            console.warn(`[Scanner] Skipped subdirectory ${fullPath}: ${error.message}`);
          }
        } else if (entry.isFile()) {
          // Check if file has a valid plugin extension
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            const plugin = await this.analyzePlugin(fullPath, format);
            if (plugin) {
              plugins.push(plugin);
            }
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`[Scanner] Directory doesn't exist: ${directory}`);
        return plugins; // Return empty array instead of throwing
      } else if (error.code === 'EACCES') {
        console.warn(`[Scanner] Permission denied: ${directory}`);
        return plugins; // Return empty array instead of throwing
      } else {
        console.error(`[Scanner] Cannot read directory ${directory}:`, error.message);
        return plugins; // Return empty array instead of throwing
      }
    }

    return plugins;
  }

  async analyzePlugin(filePath, format) {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath, path.extname(filePath));
      
      // Extract plugin info from filename (basic approach)
      const plugin = {
        id: this.generatePluginId(filePath),
        name: this.cleanPluginName(filename),
        path: filePath,
        format: format,
        vendor: this.extractVendor(filePath, filename),
        version: null, // We'll enhance this later
        size: stats.size,
        modified: stats.mtime,
        installed: true,
        category: this.guessCategory(filename),
        scanDate: new Date().toISOString()
      };

      console.log(`[Scanner] Found plugin: ${plugin.name} (${plugin.format})`);
      return plugin;

    } catch (error) {
      console.warn(`[Scanner] Failed to analyze ${filePath}: ${error.message}`);
      return null;
    }
  }

  generatePluginId(filePath) {
    // Generate a unique ID based on path and filename
    return Buffer.from(filePath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  cleanPluginName(filename) {
    // Remove common prefixes/suffixes and clean up the name
    let name = filename
      .replace(/^(VST_|VST3_|AU_)/i, '') // Remove format prefixes
      .replace(/(_x64|_x86|_64|_32|_win|_mac)$/i, '') // Remove architecture suffixes
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
    
    return name.trim();
  }

  extractVendor(filePath, filename) {
    // Try to extract vendor from path or filename
    const pathParts = filePath.split(path.sep);
    
    // Look for vendor folder names
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      if (part && part !== filename && !part.match(/^(VST|VST3|AU|Plug-Ins|Components)$/i)) {
        return part;
      }
    }
    
    // Try to extract from filename (e.g., "Serum_x64.dll" -> "Serum")
    const match = filename.match(/^([A-Za-z]+)/);
    return match ? match[1] : 'Unknown';
  }

  guessCategory(filename) {
    // Basic categorization based on common keywords
    const name = filename.toLowerCase();
    
    if (name.match(/(synth|serum|massive|operator|analog|fm|bass|lead|pad)/)) {
      return 'Synthesizer';
    } else if (name.match(/(reverb|delay|echo|chorus|flanger|phaser|distortion|compressor|eq|filter)/)) {
      return 'Effect';
    } else if (name.match(/(drum|kick|snare|hat|percussion)/)) {
      return 'Drums';
    } else if (name.match(/(sampler|kontakt|player)/)) {
      return 'Sampler';
    } else if (name.match(/(analyzer|meter|spectrum|tuner)/)) {
      return 'Utility';
    }
    
    return 'Other';
  }
}

module.exports = PluginScanner;