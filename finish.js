const params = new URLSearchParams(window.location.search);
const reason = params.get("reason") || "failed";
const file = params.get("file") || "";
const count = params.get("count") || "0";
const downloadId = Number(params.get("downloadId") || "0");
const titleElem = document.getElementById("title");
const msgElem = document.getElementById("msg");
const openBtn = document.getElementById("openBtn");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

const translations = {
  ja: {
    saved_note: {
      title: "ノートを保存しました (Mail Note Copy)",
      msg: `${file} を保存しました。Obsidian でそのフォルダを開けば表示されます。`
    },
    saved_note_attachments: {
      title: "ノートと添付を保存しました (Mail Note Copy)",
      msg: `${file} と添付 ${count} 件を保存しました。`
    },
    copied_body: {
      title: "本文をコピーしました (Mail Note Copy)",
      msg: "Markdown をクリップボードに入れました。Obsidian でノートを開いて貼り付けてください。"
    },
    no_message: {
      title: "保存できませんでした (Mail Note Copy)",
      msg: "メールが選ばれていません。保存したいメールを表示または選択してから、もう一度実行してください。"
    },
    failed: {
      title: "保存できませんでした (Mail Note Copy)",
      msg: "保存に失敗しました。メールを表示した状態でもう一度試してください。"
    },
    copyFailed: "クリップボードへのコピーに失敗しました。保存ダイアログから保存してください。",
    openFolder: "保存先を開く"
  },
  en: {
    saved_note: {
      title: "Note saved (Mail Note Copy)",
      msg: `Saved ${file}. Open that folder in Obsidian to see it.`
    },
    saved_note_attachments: {
      title: "Note and attachments saved (Mail Note Copy)",
      msg: `Saved ${file} and ${count} attachment(s).`
    },
    copied_body: {
      title: "Body copied (Mail Note Copy)",
      msg: "Markdown is on the clipboard. Open a note in Obsidian and paste."
    },
    no_message: {
      title: "Could not save (Mail Note Copy)",
      msg: "No message is selected. Open or select a message, then try again."
    },
    failed: {
      title: "Could not save (Mail Note Copy)",
      msg: "Save failed. Display the message and try again."
    },
    copyFailed: "Could not copy to the clipboard. Use Save… instead.",
    openFolder: "Open folder"
  }
};

const locale = translations[langKey] || translations.en;
const t = locale[reason] || locale.failed || translations.en.failed;
titleElem.textContent = t.title;
msgElem.textContent = t.msg;

async function copyPending() {
  if (reason !== "copied_body") {
    return;
  }
  try {
    const stored = await browser.runtime.sendMessage({ type: "finish-copy" });
    if (!stored || !stored.text) {
      throw new Error("empty");
    }
    await navigator.clipboard.writeText(stored.text);
  } catch (e) {
    msgElem.textContent = locale.copyFailed;
  }
}

const canReveal = Boolean(downloadId && (reason === "saved_note" || reason === "saved_note_attachments"));
if (canReveal) {
  openBtn.hidden = false;
  openBtn.textContent = locale.openFolder;
  openBtn.classList.add("secondary");
  openBtn.addEventListener("click", async () => {
    try {
      await browser.downloads.show(downloadId);
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

copyPending();
