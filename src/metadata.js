// AudioShelf - Plugin Metadata Manager

const fs = require('fs').promises;
const path = require('path');

class PluginMetadata {
  constructor() {
    this.metadataPath = path.join(process.cwd(), 'data', 'plugin-metadata.json');
    this.metadata = null;
    this.loadMetadata();
  }

  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf8');
      this.metadata = JSON.parse(data);
      console.log(`[Metadata] Loaded ${Object.keys(this.metadata.plugins || {}).length} plugin definitions`);
    } catch (error) {
      console.warn('[Metadata] No metadata file found, starting with empty database');
      this.metadata = {
        plugins: {},
        version: "1.0.0",
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Match plugin to metadata using multiple strategies
  findPluginMetadata(plugin) {
    if (!this.metadata?.plugins) return null;

    const normalizedName = this.normalizePluginName(plugin.name);
    
    // Strategy 1: Exact normalized name match
    if (this.metadata.plugins[normalizedName]) {
      return this.metadata.plugins[normalizedName];
    }

    // Strategy 2: Fuzzy name matching
    for (const [key, meta] of Object.entries(this.metadata.plugins)) {
      if (this.isFuzzyMatch(normalizedName, key) || 
          this.isFuzzyMatch(normalizedName, this.normalizePluginName(meta.name))) {
        return meta;
      }
    }

    // Strategy 3: Vendor + partial name match
    if (plugin.vendor) {
      const normalizedVendor = plugin.vendor.toLowerCase();
      for (const [key, meta] of Object.entries(this.metadata.plugins)) {
        if (meta.vendor?.toLowerCase().includes(normalizedVendor) &&
            normalizedName.includes(this.normalizePluginName(meta.name).substring(0, 4))) {
          return meta;
        }
      }
    }

    return null;
  }

  // Enhance plugin data with metadata
  enrichPlugin(plugin) {
    const metadata = this.findPluginMetadata(plugin);
    
    if (metadata) {
      return {
        ...plugin,
        description: metadata.description,
        category: metadata.category || plugin.category,
        subcategory: metadata.subcategory,
        tags: metadata.tags || [],
        website: metadata.website,
        logoUrl: metadata.logoUrl,
        screenshotUrl: metadata.screenshotUrl,
        price: metadata.price,
        popularity: metadata.popularity,
        releaseYear: metadata.releaseYear,
        hasMetadata: true
      };
    }

    // Return original plugin with enhancement flags
    return {
      ...plugin,
      hasMetadata: false,
      needsMetadata: true
    };
  }

  normalizePluginName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '');
  }

  isFuzzyMatch(name1, name2) {
    // Simple fuzzy matching - could be enhanced with Levenshtein distance
    const minLength = Math.min(name1.length, name2.length);
    if (minLength < 3) return false;
    
    const prefix = minLength >= 6 ? 6 : minLength;
    return name1.substring(0, prefix) === name2.substring(0, prefix);
  }

  // Generate metadata template for new plugins
  generateMetadataTemplate(plugin) {
    return {
      name: plugin.name,
      vendor: plugin.vendor || "Unknown",
      category: plugin.category,
      subcategory: null,
      description: `${plugin.category || 'Audio plugin'} by ${plugin.vendor || 'Unknown'}`,
      tags: [],
      website: null,
      logoUrl: null,
      screenshotUrl: null,
      price: "unknown",
      popularity: 0,
      releaseYear: null,
      needsReview: true
    };
  }

  // Save missing plugins for later curation
  async saveMissingPlugins(plugins) {
    const missing = plugins.filter(p => !p.hasMetadata);
    if (missing.length === 0) return;

    const missingPath = path.join(process.cwd(), 'data', 'missing-metadata.json');
    const missingData = {
      plugins: missing.map(p => this.generateMetadataTemplate(p)),
      count: missing.length,
      generatedAt: new Date().toISOString()
    };

    await fs.writeFile(missingPath, JSON.stringify(missingData, null, 2));
    console.log(`[Metadata] Saved ${missing.length} plugins needing metadata to missing-metadata.json`);
  }
}

module.exports = PluginMetadata;