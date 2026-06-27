<p align="center">
  <img src="icons/icon-128.png" alt="New Tab Plus" width="128" height="128">
</p>

# New Tab Plus

A bookmarks-driven, widget-extensible new tab page for Chrome.

**Website:** [User guide & privacy policy](https://tpbnick.github.io/new-tab-plus/)

Inspired by [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage).

## Screenshots

<p align="center">
  <img src="docs/images/new-tab-plus-1.png" alt="New Tab Plus with bookmark columns, search bar, clock, and weather widgets" width="720">
</p>

<p align="center">
  <img src="docs/images/new-tab-plus-1.png" alt="GitHub Dark theme" width="230">
  <img src="docs/images/new-tab-plus-2.png" alt="Monokai Dark theme" width="230">
  <img src="docs/images/new-tab-plus-3.png" alt="Hacker theme" width="230">
</p>
<p align="center"><em>GitHub Dark · Monokai Dark · Hacker</em></p>

<p align="center">
  <img src="docs/images/new-tab-plus-settings.png" alt="Settings panel" width="720">
</p>

<p align="center">
  <img src="docs/images/new-tab-plus-command-palette.png" alt="Command palette searching bookmarks and the web" width="720">
</p>

## Install

1. Download **`new-tab-plus-v*.zip`** from the [latest release](https://github.com/tpbnick/new-tab-plus/releases/latest).
2. Unzip the file.
3. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the unzipped folder (it should contain `manifest.json`).

## Development

```bash
npm install
npm run dev     # watch + dev server
npm test        # run tests
npm run build   # build dist/
npm run package # zip dist for release
```

Weather data is fetched from [Open-Meteo](https://open-meteo.com/) when the weather widget is enabled (requires network access).

## Possible Upcoming Features
- Calendar integration (Google, Apple)
- Sports Livescores integration (Soccer, Basketball, Football, etc.)
- Weather source options (Bring your own API key)
- More theme/font options

## License

[MIT](LICENSE)
