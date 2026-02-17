# AudioShelf Development Notes

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in development mode:**
   ```bash
   npm run dev
   ```

3. **Run normally:**
   ```bash
   npm start
   ```

## Architecture

- **main.js**: Electron main process (window management)
- **index.html**: UI layout and styling  
- **src/renderer.js**: Frontend logic and UI interactions
- **src/scanner.js**: Plugin discovery and analysis
- **src/database.js**: Local JSON file storage
- **data/**: Plugin data and metadata storage

## Platform-Specific Plugin Paths

### Windows
- **VST**: `C:\Program Files\VstPlugins`, `C:\Program Files\Steinberg\VstPlugins`
- **VST3**: `C:\Program Files\Common Files\VST3`

### macOS  
- **VST**: `/Library/Audio/Plug-Ins/VST`, `~/Library/Audio/Plug-Ins/VST`
- **VST3**: `/Library/Audio/Plug-Ins/VST3`, `~/Library/Audio/Plug-Ins/VST3`  
- **AU**: `/Library/Audio/Plug-Ins/Components`, `~/Library/Audio/Plug-Ins/Components`

## Data Storage

Plugins are stored in `~/.audioshelf/plugins.json` with the following structure:

```json
{
  "plugins": [
    {
      "id": "unique_id",
      "name": "Plugin Name",
      "path": "/path/to/plugin",
      "format": "VST3",
      "vendor": "Vendor Name",
      "version": "1.0.0",
      "category": "Synthesizer",
      "installed": true,
      "scanDate": "2026-02-17T02:00:00.000Z"
    }
  ],
  "metadata": {
    "lastScan": "2026-02-17T02:00:00.000Z",
    "platform": "darwin",
    "totalPlugins": 1
  }
}
```

## Roadmap

### MVP (v1.0)
- [x] Basic Electron app structure
- [x] Plugin scanning for VST/VST3/AU
- [x] JSON database storage
- [x] Simple plugin list UI
- [ ] Cloud sync (Dropbox/Google Drive)
- [ ] Basic plugin verification

### Future Features (v2.0+)
- [ ] Plugin screenshots/images
- [ ] Advanced categorization
- [ ] Usage analytics  
- [ ] Plugin download links integration
- [ ] Preset management
- [ ] Multi-machine sync
- [ ] Community features

## Development Notes

- Uses Node.js filesystem APIs for plugin discovery
- Cross-platform compatibility via Electron
- Lightweight JSON storage for simplicity
- Future: Consider SQLite for better performance

## Common Issues

1. **Permission errors**: Some plugin directories may require admin access
2. **Symlinks**: Need to handle symbolic links properly
3. **Large directories**: Scanning can be slow with many plugins

## Testing

Test on both Windows and macOS with various plugin configurations:
- Native Instruments plugins
- Free plugins (Helm, Dexed, etc.)  
- VST2 vs VST3 vs AU formats
- Plugins in non-standard directories