# Mail Note Copy

Thunderbird add-on that saves the selected email as a Markdown note. You choose the location in Thunderbird’s save dialog.

**Version:** 1.1.0  
**Thunderbird:** 115.0 or later  
**Add-on ID:** `mail-note-copy@k-tech-studio.com`  
**Repository:** https://github.com/crossbeat461-a11y/mail-note-copy  
**Support:** https://github.com/crossbeat461-a11y/mail-note-copy/issues  
**License:** [Mozilla Public License 2.0](LICENSE)

This add-on uses only published WebExtension APIs (`messages`, `menus`, `clipboard`, `downloads`). It does not use Experiment APIs.

---

## 日本語

### できること

メールを選んだ状態で、右クリックから次を選べます。

- **本文をコピー** — YAML プロパティ付き Markdown をクリップボードへ。今開いているノートに貼る用
- **ノートを保存** — 保存ダイアログで場所を選んで `YYYY-MM-DD_件名.md` を置く
- **ノートと添付を保存** — 本文のあと、添付も保存ダイアログで置く。OS が直前のフォルダを覚えていれば、同じ場所に置けます

ファイル名は `日付_件名`（`Re:` / `Fwd:` は除く）。元の件名、日時、From / To / CC / BCC、添付の有無はノート先頭のプロパティに残します。

### インストール

- 審査提出用: `mail-note-copy-1.1.0.xpi`（ビルドなし。XPI がソースです）
- 開発時: **アドオンとテーマ** → 歯車 → **デバッグアドオン** → **一時的なアドオンを読み込む** → `manifest.json`

---

## English

Right-click a message, then save it as `YYYY-MM-DD_subject.md` through the save dialog.

Load it in Thunderbird: **Add-ons and Themes** → gear → **Debug Add-ons** → **Load Temporary Add-on** → select `manifest.json`.
