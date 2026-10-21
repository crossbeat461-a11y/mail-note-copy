# Mail Note Copy

Thunderbird add-on that saves the selected email as a Markdown note. You pick a folder after you can see its path. No vault setting and no Obsidian plugin.

**Version:** 1.0.0  
**Thunderbird:** 115.0 or later  
**Add-on ID:** `mail-note-copy@k-tech-studio.com`  
**Repository:** https://github.com/crossbeat461-a11y/mail-note-copy  
**Support:** https://github.com/crossbeat461-a11y/mail-note-copy/issues  
**License:** [Mozilla Public License 2.0](LICENSE)

---

## 日本語

### できること

メールを選んだ状態で、右クリックから次を選べます。

- **本文をコピー** — YAML プロパティ付き Markdown をクリップボードへ。今開いているノートに貼る用
- **保存先を選んで保存** — パスが見える一覧からフォルダを選んで `YYYY-MM-DD_件名.md` を置く
- **保存先を選んで添付も保存** — 同じ画面で添付チェックが最初から入る

一覧の順は、固定した保存先 → Obsidian で今開いている場所 → 最近使った場所です。右クリックの「保存先を管理…」か、保存画面の同じボタンでフォルダを一度登録できます。空でも最近使った場所だけで使えます。黙って保存はしません。

ファイル名は `日付_件名`（`Re:` / `Fwd:` は除く）。元の件名、日時、From / To / CC / BCC、添付の有無はノート先頭のプロパティに残します。

### インストール

- 審査提出用: `mail-note-copy-1.0.0.xpi`（ビルドなし。XPI がソースです）
- 開発時: **アドオンとテーマ** → 歯車 → **デバッグアドオン** → **一時的なアドオンを読み込む** → `manifest.json`

初回は「Thunderbird とコンピュータへのフルアクセス」と出ます。選んだフォルダへノートと添付を書き込むためです。

---

## English

Right-click a message, then choose a destination whose path is visible. The note is written as `YYYY-MM-DD_subject.md`.

Load it in Thunderbird: **Add-ons and Themes** → gear → **Debug Add-ons** → **Load Temporary Add-on** → select `manifest.json`.
