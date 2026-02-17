// Bulk Metadata Creator for AudioShelf
// Usage: node scripts/bulk-metadata-creator.js <plugin-list.json>

const fs = require('fs').promises;
const path = require('path');

class BulkMetadataCreator {
  constructor() {
    this.metadataPath = path.join(process.cwd(), 'data', 'plugin-metadata.json');
    this.knownPlugins = new Map();
    this.loadKnownCategories();
  }

  // Load existing metadata
  async loadExistingMetadata() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf8');
      const metadata = JSON.parse(data);
      return metadata.plugins || {};
    } catch (error) {
      console.log('No existing metadata found, starting fresh');
      return {};
    }
  }

  // Enhanced category guessing with more keywords
  guessCategory(pluginName, vendor = '') {
    const name = pluginName.toLowerCase();
    const vendorLower = vendor.toLowerCase();

    // Synthesizers
    if (name.match(/(synth|serum|massive|operator|analog|fm|bass|lead|pad|osc|wave|sub|acid)/)) {
      return { category: 'Synthesizer', subcategory: this.guessSynthSubcategory(name) };
    }
    
    // Effects - EQ
    if (name.match(/(eq|equalizer|pro-q|fabfilter|frequency|spectrum)/)) {
      return { category: 'Effect', subcategory: 'EQ' };
    }
    
    // Effects - Reverb/Delay
    if (name.match(/(reverb|delay|echo|space|hall|room|plate|spring|valhalla)/)) {
      return { category: 'Effect', subcategory: 'Reverb/Delay' };
    }
    
    // Effects - Dynamics
    if (name.match(/(compressor|limiter|gate|expander|dynamics|pro-c|pro-l)/)) {
      return { category: 'Effect', subcategory: 'Dynamics' };
    }
    
    // Effects - Distortion
    if (name.match(/(distortion|overdrive|saturator|tube|vintage|warmth|drive)/)) {
      return { category: 'Effect', subcategory: 'Distortion/Saturation' };
    }
    
    // Effects - Modulation
    if (name.match(/(chorus|flanger|phaser|tremolo|vibrato|modulation)/)) {
      return { category: 'Effect', subcategory: 'Modulation' };
    }
    
    // Samplers/Sample Players
    if (name.match(/(kontakt|sampler|player|battery|maschine|machine)/)) {
      return { category: 'Sampler', subcategory: 'Advanced Sampler' };
    }
    
    // Drum Machines
    if (name.match(/(drum|beat|rhythm|kick|snare|hat|percussion|battery)/)) {
      return { category: 'Drums', subcategory: 'Drum Machine' };
    }
    
    // Piano/Keys
    if (name.match(/(piano|keys|wurli|rhodes|electric|organ|vintage)/)) {
      return { category: 'Synthesizer', subcategory: 'Keys/Piano' };
    }
    
    // Guitar/Bass
    if (name.match(/(guitar|bass|amp|cab|rig|amplitube)/)) {
      return { category: 'Effect', subcategory: 'Guitar/Bass' };
    }
    
    // Mastering/Mixing Suites
    if (name.match(/(ozone|master|mixing|suite|pro|bundle)/)) {
      return { category: 'Effect', subcategory: 'Mastering Suite' };
    }
    
    // Utilities
    if (name.match(/(analyzer|meter|spectrum|tuner|utility|tool)/)) {
      return { category: 'Utility', subcategory: 'Analysis' };
    }

    return { category: 'Other', subcategory: null };
  }

  guessSynthSubcategory(name) {
    if (name.match(/(wave|serum|massive)/)) return 'Wavetable';
    if (name.match(/(fm|operator|dx)/)) return 'FM';
    if (name.match(/(analog|sub|acid|bass)/)) return 'Analog';
    if (name.match(/(piano|keys|wurli|rhodes)/)) return 'Keys/Piano';
    if (name.match(/(drum|percussion)/)) return 'Drum';
    return 'Subtractive';
  }

  // Generate enhanced descriptions based on plugin info
  generateDescription(plugin) {
    const { name, vendor, category, subcategory } = plugin;
    
    // Try to create a more specific description
    if (subcategory === 'Wavetable') {
      return `Wavetable synthesizer with advanced modulation capabilities. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (subcategory === 'EQ') {
      return `Professional equalizer plugin for precise frequency shaping and mixing. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (subcategory === 'Reverb/Delay') {
      return `High-quality reverb and delay effects for spatial audio processing. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (subcategory === 'Keys/Piano') {
      return `Authentic piano and keyboard emulation with vintage character. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (subcategory === 'Guitar/Bass') {
      return `Guitar and bass amplifier/effects simulation for realistic tones. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (subcategory === 'Advanced Sampler') {
      return `Professional sampling instrument and library host. ${vendor ? `By ${vendor}.` : ''}`;
    } else if (category === 'Effect') {
      return `Audio effect processor for creative and corrective audio processing. ${vendor ? `By ${vendor}.` : ''}`;
    }
    
    return `${category || 'Audio plugin'} ${vendor ? `by ${vendor}` : ''} for professional music production.`.trim();
  }

  // Generate tags based on plugin info
  generateTags(plugin) {
    const tags = [];
    const name = plugin.name.toLowerCase();
    const category = plugin.category?.toLowerCase() || '';
    const subcategory = plugin.subcategory?.toLowerCase() || '';
    
    // Add category-based tags
    if (category === 'synthesizer') {
      tags.push('synthesizer', 'synth');
      if (subcategory === 'wavetable') tags.push('wavetable', 'electronic');
      if (subcategory === 'analog') tags.push('analog', 'vintage');
    }
    
    if (category === 'effect') {
      tags.push('effect', 'processing');
      if (subcategory === 'eq') tags.push('equalizer', 'mixing');
      if (subcategory === 'reverb/delay') tags.push('reverb', 'delay', 'spatial');
    }
    
    // Add genre-based tags from name analysis
    if (name.match(/(bass|sub|dubstep)/)) tags.push('bass', 'electronic');
    if (name.match(/(vintage|retro|analog)/)) tags.push('vintage', 'retro');
    if (name.match(/(free|lite)/)) tags.push('free');
    if (plugin.isDemo) tags.push('demo', 'trial');
    
    return [...new Set(tags)]; // Remove duplicates
  }

  // Process plugin list and generate metadata
  async processBulkList(pluginListPath) {
    console.log(`🔄 Processing plugin list: ${pluginListPath}`);
    
    // Load plugin list
    const pluginData = JSON.parse(await fs.readFile(pluginListPath, 'utf8'));
    const plugins = pluginData.plugins || pluginData; // Handle both formats
    
    console.log(`📋 Found ${plugins.length} plugins to process`);
    
    // Load existing metadata
    const existingMetadata = await this.loadExistingMetadata();
    let newCount = 0;
    let updatedCount = 0;
    
    // Process each plugin
    for (const plugin of plugins) {
      const normalizedName = this.normalizePluginName(plugin.name);
      
      if (!existingMetadata[normalizedName]) {
        // Create new metadata entry
        const categoryInfo = this.guessCategory(plugin.name, plugin.vendor);
        
        existingMetadata[normalizedName] = {
          name: plugin.name,
          vendor: plugin.vendor || 'Unknown',
          category: categoryInfo.category,
          subcategory: categoryInfo.subcategory,
          description: this.generateDescription({
            name: plugin.name,
            vendor: plugin.vendor,
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory
          }),
          tags: this.generateTags({
            name: plugin.name,
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory,
            isDemo: plugin.isDemo
          }),
          website: null,
          logoUrl: null,
          screenshotUrl: null,
          price: plugin.isDemo ? 'demo' : 'unknown',
          popularity: 0,
          releaseYear: null,
          needsReview: true
        };
        newCount++;
      } else {
        // Update existing entry if needed
        const existing = existingMetadata[normalizedName];
        if (!existing.tags || existing.tags.length === 0) {
          existing.tags = this.generateTags({
            name: plugin.name,
            category: existing.category,
            subcategory: existing.subcategory,
            isDemo: plugin.isDemo
          });
          updatedCount++;
        }
      }
    }
    
    // Save updated metadata
    const updatedMetadata = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      plugins: existingMetadata
    };
    
    await fs.writeFile(this.metadataPath, JSON.stringify(updatedMetadata, null, 2));
    
    console.log(`✅ Processing complete:`);
    console.log(`   📝 ${newCount} new plugin entries created`);
    console.log(`   🔄 ${updatedCount} existing entries updated`);
    console.log(`   📊 Total database size: ${Object.keys(existingMetadata).length} plugins`);
    console.log(`   💾 Saved to: ${this.metadataPath}`);
    
    return { newCount, updatedCount, totalCount: Object.keys(existingMetadata).length };
  }

  normalizePluginName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }

  loadKnownCategories() {
    // Could load from external source or API in future
    this.knownPlugins.set('serum', 'Wavetable Synthesizer');
    this.knownPlugins.set('massive', 'Wavetable Synthesizer');
    // Add more as needed
  }
}

// CLI Usage
if (require.main === module) {
  const pluginListPath = process.argv[2];
  
  if (!pluginListPath) {
    console.log('Usage: node bulk-metadata-creator.js <plugin-list.json>');
    console.log('');
    console.log('Example: node bulk-metadata-creator.js /path/to/audioshelf-plugins-2026-02-17.json');
    process.exit(1);
  }
  
  const creator = new BulkMetadataCreator();
  creator.processBulkList(pluginListPath).catch(console.error);
}

module.exports = BulkMetadataCreator;