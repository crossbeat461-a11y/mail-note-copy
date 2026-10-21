const params = new URLSearchParams(window.location.search);
const reason = params.get("reason") || "failed";
const file = params.get("file") || "";
const savedPath = params.get("path") || "";
const count = params.get("count") || "0";
const titleElem = document.getElementById("title");
const msgElem = document.getElementById("msg");
const openBtn = document.getElementById("openBtn");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

const translations = {
  ja: {
    saved_note: {
      title: "ノートを保存しました (Mail Note Copy)",
      msg: `${file} を保存しました。Obsidian をそのフォルダに切り替えれば表示されます。`
    },
    saved_note_attachments: {
      title: "ノートと添付を保存しました (Mail Note Copy)",
      msg: `${file} と添付 ${count} 件を同じフォルダに保存しました。`
    },
    copied_body: {
      title: "本文をコピーしました (Mail Note Copy)",
      msg: "Markdown をクリップボードに入れました。Obsidian でノートを開いて貼り付けてください。新しいファイルを置くときは「ノートを保存…」を使ってください。"
    },
    copied_body_fallback: {
      title: "本文をコピーしました (Mail Note Copy)",
      msg: "保存ダイアログが使えないため、本文だけをコピーしました。ノートを開いて貼り付けてください。"
    },
    no_message: {
      title: "保存できませんでした (Mail Note Copy)",
      msg: "メールが選ばれていません。保存したいメールを表示または選択してから、もう一度実行してください。"
    },
    failed: {
      title: "保存できませんでした (Mail Note Copy)",
      msg: "保存に失敗しました。メールを表示した状態でもう一度試してください。"
    },
    openFolder: "保存先を開く"
  },
  en: {
    saved_note: {
      title: "Note saved (Mail Note Copy)",
      msg: `Saved ${file}. Switch to that folder in Obsidian to see it.`
    },
    saved_note_attachments: {
      title: "Note and attachments saved (Mail Note Copy)",
      msg: `Saved ${file} and ${count} attachment(s) in the same folder.`
    },
    copied_body: {
      title: "Body copied (Mail Note Copy)",
      msg: "Markdown is on the clipboard. Open a note in Obsidian and paste. To create a new file, use Save note…"
    },
    copied_body_fallback: {
      title: "Body copied (Mail Note Copy)",
      msg: "The save dialog is unavailable, so only the body was copied. Open a note and paste."
    },
    no_message: {
      title: "Could not save (Mail Note Copy)",
      msg: "No message is selected. Open or select a message, then try again."
    },
    failed: {
      title: "Could not save (Mail Note Copy)",
      msg: "Save failed. Display the message and try again."
    },
    openFolder: "Open folder"
  }
};

const locale = translations[langKey] || translations.en;
const t = locale[reason] || locale.failed || translations.en.failed;
titleElem.textContent = t.title;
msgElem.textContent = t.msg;

const canReveal = Boolean(savedPath && (reason === "saved_note" || reason === "saved_note_attachments"));
if (canReveal) {
  openBtn.hidden = false;
  openBtn.textContent = locale.openFolder;
  openBtn.classList.add("secondary");
  openBtn.addEventListener("click", async () => {
    try {
      await browser.mailNoteFiles.revealPath(savedPath);
    } catch (e) {
      console.error("Reveal failed:", e);
    }
  });
}

document.getElementById("okBtn").addEventListener("click", async () => {
  try {
    const currentWin = await browser.windows.getCurrent();
    await browser.windows.remove(currentWin.id);
  } catch (e) {
    window.close();
  }
});
