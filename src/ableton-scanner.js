// AudioShelf - Ableton Project Scanner Module
// Scans .als files to find which VST plugins are used in projects

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

class AbletonScanner {
  constructor() {
    // Mixy's Ableton projects path (hardcoded for now)
    this.abletonProjectsPath = '/Users/mixy/Dropbox/Music Creation/Ableton Projects';
  }

  async scanAllProjects() {
    try {
      console.log(`[AbletonScanner] Scanning projects in: ${this.abletonProjectsPath}`);
      
      // Find all .als files in the directory (including subdirectories)
      const alsFiles = await this.findALSFiles(this.abletonProjectsPath);
      console.log(`[AbletonScanner] Found ${alsFiles.length} .als files`);

      const projectData = [];

      for (const alsFile of alsFiles) {
        try {
          const project = await this.parseProject(alsFile);
          if (project) {
            projectData.push(project);
          }
        } catch (error) {
          console.warn(`[AbletonScanner] Failed to parse ${alsFile}:`, error.message);
        }
      }

      console.log(`[AbletonScanner] Successfully parsed ${projectData.length} projects`);
      return projectData;
      
    } catch (error) {
      console.error('[AbletonScanner] Scan failed:', error);
      throw error;
    }
  }

  async findALSFiles(dirPath) {
    const alsFiles = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.findALSFiles(fullPath);
          alsFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.als')) {
          alsFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[AbletonScanner] Cannot read directory ${dirPath}:`, error.message);
    }

    return alsFiles;
  }

  async parseProject(alsFilePath) {
    try {
      console.log(`[AbletonScanner] Parsing project: ${path.basename(alsFilePath)}`);

      // Read the .als file (it's gzipped XML)
      const compressedData = await fs.readFile(alsFilePath);
      const xmlData = await gunzip(compressedData);
      const xmlString = xmlData.toString('utf-8');

      // DEBUG: Show VST plugin XML structure for projects with VST info
      if (alsFilePath.includes('Intrigue and the Beacon')) {
        console.log('[AbletonScanner] DEBUG: Looking for VST plugin XML structure...');
        
        // Search for common plugin names to see how they appear in XML
        const knownPlugins = ['EZdrummer', 'Trash', 'Helix', 'Native', 'iZotope', 'Serum', 'Massive'];
        knownPlugins.forEach(pluginName => {
          if (xmlString.includes(pluginName)) {
            console.log(`[AbletonScanner] DEBUG: Found "${pluginName}" in XML! Looking for context...`);
            
            // Find 200 chars before and after the plugin name
            const index = xmlString.indexOf(pluginName);
            const start = Math.max(0, index - 200);
            const end = Math.min(xmlString.length, index + pluginName.length + 200);
            const context = xmlString.substring(start, end);
            
            console.log(`[AbletonScanner] DEBUG: Context around "${pluginName}": ...${context}...`);
          }
        });
        
        // Find and show actual Vst3PluginInfo sections
        const vst3Matches = xmlString.match(/<Vst3PluginInfo[^>]*>[\s\S]{0,500}?<\/Vst3PluginInfo>/g);
        if (vst3Matches) {
          console.log(`[AbletonScanner] DEBUG: Found ${vst3Matches.length} Vst3PluginInfo sections. First 2:`);
          console.log('VST3 #1:', vst3Matches[0]);
          if (vst3Matches[1]) console.log('VST3 #2:', vst3Matches[1]);
        }
        
        // Find PluginDevice sections
        const pluginDeviceMatches = xmlString.match(/<PluginDevice[^>]*>[\s\S]{0,800}?<\/PluginDevice>/g);
        if (pluginDeviceMatches) {
          console.log(`[AbletonScanner] DEBUG: Found ${pluginDeviceMatches.length} PluginDevice sections. First 2:`);
          console.log('PluginDevice #1:', pluginDeviceMatches[0]);
          if (pluginDeviceMatches[1]) console.log('PluginDevice #2:', pluginDeviceMatches[1]);
        }
      }

      // Extract project info
      const projectName = this.extractProjectName(xmlString) || path.basename(alsFilePath, '.als');
      const vstPlugins = this.extractVSTPlugins(xmlString);

      return {
        name: projectName,
        filePath: alsFilePath,
        fileName: path.basename(alsFilePath),
        vstPlugins: vstPlugins,
        lastModified: (await fs.stat(alsFilePath)).mtime
      };

    } catch (error) {
      console.error(`[AbletonScanner] Failed to parse ${alsFilePath}:`, error);
      return null;
    }
  }

  extractProjectName(xmlString) {
    // Try to find the project name in the XML
    // Ableton stores this in various places, let's try the most common ones
    
    // Look for LiveSet name attribute
    let match = xmlString.match(/<LiveSet[^>]*Name="([^"]*)"[^>]*>/);
    if (match && match[1]) {
      return match[1];
    }

    // Look for project title in metadata
    match = xmlString.match(/<Title[^>]*Value="([^"]*)"[^>]*\/>/);
    if (match && match[1]) {
      return match[1];
    }

    return null; // Will fall back to filename
  }

  extractVSTPlugins(xmlString) {
    const plugins = [];
    
    // DEBUG: Switch to looking for actually loaded plugins, not browser history
    console.log('[AbletonScanner] DEBUG: Looking for actually LOADED plugins in PluginDevice elements...');
    
    // Count different plugin-related elements to understand structure
    const pluginDeviceCount = (xmlString.match(/<PluginDevice[^>]*>/g) || []).length;
    const vst3InfoCount = (xmlString.match(/<Vst3PluginInfo[^>]*>/g) || []).length;
    const vstInfoCount = (xmlString.match(/<VstPluginInfo[^>]*>/g) || []).length;
    const browserPathCount = (xmlString.match(/<BrowserContentPath[^>]*>/g) || []).length;
    
    console.log(`[AbletonScanner] DEBUG: Found ${pluginDeviceCount} PluginDevice, ${vst3InfoCount} Vst3PluginInfo, ${vstInfoCount} VstPluginInfo, ${browserPathCount} BrowserContentPath`);
    
    // If this project has lots of browser paths but few plugin devices, that explains the contamination
    if (browserPathCount > pluginDeviceCount * 2) {
      console.log(`[AbletonScanner] DEBUG: WARNING: ${browserPathCount} browser paths vs ${pluginDeviceCount} plugin devices - browser history contamination likely!`);
    }
    
    // SIMPLE APPROACH: Find ANY VST plugin references, then filter out junk
    // Cast a wide net, then clean up the results
    
    const vstPatterns = [
      // VST3 plugin names from any context
      /<Vst3PluginInfo[^>]*>[\s\S]*?<Name[^>]*Value="([^"]*)"[^>]*\/>/g,
      
      // VST2 plugin filenames from any context
      /<VstPluginInfo[^>]*>[\s\S]*?<FileName[^>]*Value="([^"]*)"[^>]*\/>/g,
      
      // Also check BrowserContentPath but filter heavily
      /<BrowserContentPath[^>]*Value="query:Plugins#(?:VST3?|AU):[^:]*:([^"]*)"[^>]*\/>/g
    ];

    vstPatterns.forEach((pattern, index) => {
      console.log(`[AbletonScanner] DEBUG: Trying pattern ${index + 1}...`);
      let match;
      let patternMatches = 0;
      while ((match = pattern.exec(xmlString)) !== null) {
        patternMatches++;
        let rawPluginName = match[1];
        console.log(`[AbletonScanner] DEBUG: Raw plugin name from pattern ${index + 1}: "${rawPluginName}"`);
        
        let processedPluginName = rawPluginName;
        
        // URL decode if needed (for BrowserContentPath entries)
        if (rawPluginName.includes('%')) {
          try {
            processedPluginName = decodeURIComponent(rawPluginName);
          } catch (error) {
            processedPluginName = rawPluginName; // Keep original if decode fails
          }
        }
        
        // Clean up the plugin name
        let cleanedPluginName = this.cleanPluginName(processedPluginName);
        console.log(`[AbletonScanner] DEBUG: Pattern ${index + 1} found: "${rawPluginName}" → "${processedPluginName}" → "${cleanedPluginName || 'FILTERED OUT'}"`);
        
        if (cleanedPluginName && !plugins.includes(cleanedPluginName)) {
          plugins.push(cleanedPluginName);
          console.log(`[AbletonScanner] DEBUG: ACCEPTED plugin via pattern ${index + 1}: "${rawPluginName}" → "${cleanedPluginName}"`);
        } else if (!cleanedPluginName) {
          console.log(`[AbletonScanner] DEBUG: FILTERED OUT plugin: "${rawPluginName}" (cleaned to null)`);
        }
      }
      if (patternMatches > 0) {
        console.log(`[AbletonScanner] DEBUG: Pattern ${index + 1} found ${patternMatches} raw matches`);
      }
    });

    // Skip the simple pattern - focus only on PluginDevice-contained plugins

    // IMPORTANT: Deduplicate plugins (same plugin can be referenced multiple times per project)
    const uniquePlugins = [...new Set(plugins)];
    
    console.log(`[AbletonScanner] Found ${plugins.length} VST plugin references, ${uniquePlugins.length} unique plugins in project:`, uniquePlugins);
    
    // DEBUG: If this project has duplicates, show the difference
    if (plugins.length !== uniquePlugins.length) {
      console.log(`[AbletonScanner] DEBUG: Deduplicated ${plugins.length - uniquePlugins.length} duplicate plugin references`);
    }
    
    return uniquePlugins.sort();
  }

  cleanPluginName(rawName) {
    if (!rawName) return null;

    // Remove file extensions that might come from VstPluginInfo FileName
    let cleaned = rawName.replace(/\.(dll|vst|vst3|component)$/i, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Skip empty or very short names
    if (!cleaned || cleaned.length < 2) return null;
    
    // Skip common Ableton built-in devices (these aren't VSTs)
    const builtInDevices = [
      'Operator', 'Simpler', 'Impulse', 'DrumRack', 'InstrumentRack',
      'Wavetable', 'Bass', 'Collision', 'Tension', 'Analog', 'Compressor',
      'EQ Eight', 'Reverb', 'Delay', 'Chorus', 'Flanger', 'Phaser',
      'AutoFilter', 'AutoPan', 'Saturator', 'Redux', 'Vocoder',
      'Spectrum', 'Tuner', 'Limiter', 'Gate', 'Multiband Dynamics'
    ];
    
    if (builtInDevices.includes(cleaned)) return null;
    
    // Skip obvious junk that might come from browser history
    // But be less aggressive - focus on obvious non-plugin patterns
    const junkPatterns = [
      /^(Track|Audio|Master)\s*\d*$/i,  // Track names
      /^\d+\s*-\s*/,                    // "1 - Something" patterns  
      /\d{4}-\d{2}-\d{2}/,             // Timestamps
      /^[a-f0-9]{8}-[a-f0-9]{4}/i      // GUIDs
    ];
    
    for (const pattern of junkPatterns) {
      if (pattern.test(cleaned)) return null;
    }
    
    // Accept anything else that looks like a reasonable plugin name
    return cleaned;
  }

  // Method to match Ableton plugin names to AudioShelf plugin database
  matchPluginsToDatabase(abletonPlugins, databasePlugins) {
    const matches = [];
    
    for (const abletonPlugin of abletonPlugins) {
      // Try to find a matching plugin in the database
      const match = databasePlugins.find(dbPlugin => {
        // Simple name matching (case-insensitive)
        return dbPlugin.name.toLowerCase() === abletonPlugin.toLowerCase();
      });
      
      if (match) {
        matches.push({
          abletonName: abletonPlugin,
          databaseId: match.id,
          databasePlugin: match
        });
      } else {
        // No match found - this VST might not be in the AudioShelf database
        console.log(`[AbletonScanner] No database match for plugin: ${abletonPlugin}`);
      }
    }
    
    return matches;
  }
}

module.exports = AbletonScanner;