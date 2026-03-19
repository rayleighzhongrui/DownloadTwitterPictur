# Internationalization (i18n) Support

## Supported Languages

This extension now supports multiple languages:

- **English (en)** - Default language
- **German (de)** - Deutsch
- **Japanese (ja)** - 日本語
- **Chinese (zh)** - 中文 (简体)
- **Russian (ru)** - Русский
- **Czech (cs)** - Čeština
- **Korean (ko)** - 한국어

## How to Test Different Languages

### Method 1: Change Browser Language (Chrome)

1. Open Chrome settings: `chrome://settings/languages`
2. Click "Add languages" and add the language you want to test
3. Move the desired language to the top of the list
4. Reload the extension:
   - Go to `chrome://extensions/`
   - Find this extension
   - Click the reload icon (🔄)
5. Open the extension popup to see the translated interface

### Method 2: Test with Chrome Command Line Flag

**Windows:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --lang=de
```

**Mac:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --lang=de
```

**Linux:**
```bash
google-chrome --lang=de
```

## Language Codes

- `en` - English
- `de` - German (Deutsch)
- `ja` - Japanese (日本語)
- `zh` - Chinese (中文)
- `ru` - Russian (Русский)
- `cs` - Czech (Čeština)
- `ko` - Korean (한국어)

## File Structure

```
_locales/
├── cs/
│   └── messages.json    # Czech translations (čeština)
├── de/
│   └── messages.json    # German translations (Deutsch)
├── en/
│   └── messages.json    # English translations (default)
├── ja/
│   └── messages.json    # Japanese translations (日本語)
├── ko/
│   └── messages.json    # Korean translations (한국어)
├── ru/
│   └── messages.json    # Russian translations (Русский)
└── zh/
    └── messages.json    # Chinese translations (中文)
```

## Adding New Languages

To add a new language:

1. Create a new directory under `_locales/` with the language code (e.g., `fr` for French)
2. Copy `messages.json` from `en/` or `de/`
3. Translate all the `message` values
4. The extension will automatically use the new language based on browser settings

## Translation Keys

All translatable text uses the `data-i18n` attribute in HTML and corresponds to keys in `messages.json`:

- `extensionName` - Extension name
- `extensionDescription` - Extension description
- `popupTitle` - Popup page title
- `twitterLabel` - Twitter switch label
- `pixivLabel` - Pixiv switch label
- `twitterFormatTitle` - Twitter format section title
- `pixivFormatTitle` - Pixiv format section title
- `formatAccount` - Account format option
- `formatTweetId` - Tweet ID format option
- `formatTweetTime` - Tweet time format option
- `formatDownloadDate` - Download date format option
- `formatAuthorName` - Author name format option
- `formatAuthorId` - Author ID format option
- `formatIllustId` - Illustration ID format option
- `exampleTwitterImage` - Twitter image example title
- `exampleTwitterVideo` - Twitter video example title
- `examplePixiv` - Pixiv example title
- `saveButton` - Save button text
- `saveSuccess` - Success message
- `settingsUpdated` - Settings updated message
