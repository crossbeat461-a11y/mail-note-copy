const heading = document.getElementById("heading");
const lead = document.getElementById("lead");
const fileLine = document.getElementById("fileLine");
const attBox = document.getElementById("attBox");
const attLabel = document.getElementById("attLabel");
const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyBtn");
const closeBtn = document.getElementById("closeBtn");
const status = document.getElementById("status");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

let noteMarkdown = "";

const t = {
  ja: {
    heading: "ノートを保存",
    lead: "保存ダイアログで場所を選びます。添付がある場合は、続けて同じ操作で保存できます。OS が直前のフォルダを覚えていれば、Vault にも置けます。",
    file: "ファイル名",
    att: "添付も保存する",
    attNone: "このメールに添付はありません",
    attList: "添付",
    save: "保存…",
    copy: "本文をコピー",
    close: "閉じる",
    saved: "保存しました。",
    copied: "本文をコピーしました。",
    failed: "保存に失敗しました。",
    cancelled: "キャンセルしました。"
  },
  en: {
    heading: "Save note",
    lead: "Choose a location in the save dialog. If there are attachments, you will be asked for each file. The OS often remembers the last folder, so you can save into a vault.",
    file: "File name",
    att: "Also save attachments",
    attNone: "This message has no attachments",
    attList: "Attachments",
    save: "Save…",
    copy: "Copy body",
    close: "Close",
    saved: "Saved.",
    copied: "Body copied.",
    failed: "Save failed.",
    cancelled: "Cancelled."
  }
}[langKey === "ja" ? "ja" : "en"];

heading.textContent = t.heading;
lead.textContent = t.lead;
attLabel.textContent = t.att;
saveBtn.textContent = t.save;
copyBtn.textContent = t.copy;
closeBtn.textContent = t.close;

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind || "";
}

function formatSaved(result) {
  let text = `${t.saved} ${result.file}`;
  if (result.path) {
    text += `\n${result.path}`;
  }
  if (result.wanted) {
    text += `\n${t.attList}: ${result.count}/${result.available}`;
    if (result.attachmentErrors && result.attachmentErrors.length) {
      text += `\n${result.attachmentErrors.join("\n")}`;
    }
  }
  return text;
}

saveBtn.addEventListener("click", async () => {
  setStatus("", "");
  const result = await browser.runtime.sendMessage({
    type: "dest-save",
    includeAttachments: attBox.checked
  });
  if (result && result.cancelled) {
    setStatus(t.cancelled, "");
    return;
  }
  if (result && result.ok) {
    const failedAtt = result.wanted && result.available && result.count === 0;
    setStatus(formatSaved(result), failedAtt ? "err" : "ok");
    return;
  }
  setStatus((result && result.error) || t.failed, "err");
});

copyBtn.addEventListener("click", async () => {
  setStatus("", "");
  if (!noteMarkdown) {
    setStatus(t.failed, "err");
    return;
  }
  try {
    await navigator.clipboard.writeText(noteMarkdown);
    setStatus(t.copied, "ok");
  } catch (e) {
    setStatus(t.failed, "err");
  }
});

closeBtn.addEventListener("click", async () => {
  try {
    const currentWin = await browser.windows.getCurrent();
    await browser.windows.remove(currentWin.id);
  } catch (e) {
    window.close();
  }
});

(async function init() {
  const data = await browser.runtime.sendMessage({ type: "dest-ready" });
  if (!data || !data.note) {
    setStatus(t.failed, "err");
    return;
  }
  noteMarkdown = data.note.markdown || "";
  fileLine.textContent = "";
  fileLine.appendChild(document.createTextNode(`${t.file}: `));
  const code = document.createElement("code");
  code.textContent = data.note.fileName;
  fileLine.appendChild(code);
  const names = data.attachmentNames || [];
  attBox.checked = Boolean(data.includeAttachments) && names.length > 0;
  attBox.disabled = names.length === 0;
  attLabel.textContent =
    names.length === 0
      ? t.attNone
      : `${t.att}（${names.length}: ${names.join(", ")}）`;
})();
