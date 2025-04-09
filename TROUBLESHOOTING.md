# SiteScribe Troubleshooting Guide

## Diagnostic Output Interpretation

### Permissions
- `tabs`: Required to access browser tab information ✅
- `activeTab`: Allows temporary access to the current tab ✅
- `webRequest`: Enables capturing network requests ✅
- `storage`: Allows saving and retrieving extension settings ✅

### Potential Issues and Solutions

#### 1. Permission Denied
If any permission returns `false`:
- Open Chrome Extensions
- Find SiteScribe
- Click "Details"
- Ensure "Allow access to file URLs" is checked
- Reload extension

#### 2. Content Script Injection Failed
Possible causes:
- Extension not properly installed
- Conflicting browser extensions
- Restricted web pages (e.g., Chrome internal pages)

Steps to resolve:
1. Uninstall and reinstall the extension
2. Disable other extensions temporarily
3. Verify manifest.json content script configuration

#### 3. Network Request Capture Issues
If `networkRequests` is 0 or capture is disabled:
- Check extension settings
- Verify `webRequest` permission
- Ensure no browser security settings block request capture

#### 4. Storage Access Problems
If storage test fails:
- Clear browser profile data
- Restart Chrome
- Reinstall extension

## Advanced Debugging

### Logging
- Check Chrome DevTools Console for detailed logs
- Look for emoji-prefixed messages:
  - 🔍 Capture start
  - 📋 Settings details
  - 📦 Page content info
  - ❌ Error messages

### Common Troubleshooting Commands
```bash
# Reinstall dependencies
npm install

# Rebuild extension
npm run build

# Package for Chrome
npm run package
```

## When to Seek Further Help
- Persistent issues after following this guide
- Unique error messages not covered here
- Performance or capture inconsistencies

Contact: support@luceresearch.com
