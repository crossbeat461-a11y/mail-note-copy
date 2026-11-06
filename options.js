const heading = document.getElementById("heading");
const lead = document.getElementById("lead");
const list = document.getElementById("list");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

const t = {
  ja: {
    heading: "Mail Note Copy",
    lead: "選んだメールを Markdown にして保存します。コンピュータ全体へのフルアクセスは使いません。",
    items: [
      "本文をコピー: クリップボードへ入れます。今開いているノートへ貼れます。",
      "ノートを保存: Thunderbird の保存ダイアログで場所と名前を選びます。",
      "添付も保存する場合は、ファイルごとに保存ダイアログが出ます。直前のフォルダを覚えていれば、同じ場所に置けます。"
    ]
  },
  en: {
    heading: "Mail Note Copy",
    lead: "Saves the selected email as Markdown. It does not request full access to your computer.",
    items: [
      "Copy body: puts Markdown on the clipboard so you can paste into an open note.",
      "Save note: choose the location and name in Thunderbird’s save dialog.",
      "If you save attachments too, a save dialog appears for each file. The OS often remembers the last folder."
    ]
  }
}[langKey === "ja" ? "ja" : "en"];

heading.textContent = t.heading;
lead.textContent = t.lead;
list.innerHTML = "";
for (const item of t.items) {
  const li = document.createElement("li");
  li.textContent = item;
  list.appendChild(li);
}
