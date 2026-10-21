const heading = document.getElementById("heading");
const lead = document.getElementById("lead");
const fileLine = document.getElementById("fileLine");
const attBox = document.getElementById("attBox");
const attLabel = document.getElementById("attLabel");
const groups = document.getElementById("groups");
const browseBtn = document.getElementById("browseBtn");
const manageBtn = document.getElementById("manageBtn");
const closeBtn = document.getElementById("closeBtn");
const status = document.getElementById("status");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

const t = {
  ja: {
    heading: "保存先を選ぶ",
    lead: "パスが見えている場所を選んで保存します。階層を毎回たどる必要はありません。",
    file: "ファイル名",
    att: "添付も同じフォルダに保存する",
    attNone: "このメールに添付はありません",
    attList: "添付",
    pinned: "固定した保存先",
    openNow: "Obsidian で今開いている場所",
    recent: "最近使った場所",
    browse: "別のフォルダを選ぶ…",
    manage: "保存先を管理…",
    close: "閉じる",
    empty: "まだ保存先がありません。固定するか、下のボタンでフォルダを選んでください。",
    saved: "保存しました。",
    failed: "保存に失敗しました。",
    cancelled: "キャンセルしました。"
  },
  en: {
    heading: "Choose a save location",
    lead: "Pick a folder whose path you can see. You do not need to walk the tree every time.",
    file: "File name",
    att: "Also save attachments in the same folder",
    attNone: "This message has no attachments",
    attList: "Attachments",
    pinned: "Pinned folders",
    openNow: "Currently open in Obsidian",
    recent: "Recent folders",
    browse: "Choose another folder…",
    manage: "Manage destinations…",
    close: "Close",
    empty: "No destinations yet. Pin folders or choose one below.",
    saved: "Saved.",
    failed: "Save failed.",
    cancelled: "Cancelled."
  }
}[langKey === "ja" ? "ja" : "en"];

heading.textContent = t.heading;
lead.textContent = t.lead;
attLabel.textContent = t.att;
browseBtn.textContent = t.browse;
manageBtn.textContent = t.manage;
closeBtn.textContent = t.close;

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind || "";
}

function formatSaved(result) {
  let text = `${t.saved} ${result.file}\n${result.dir}`;
  if (result.wanted) {
    text += `\n${t.attList}: ${result.count}/${result.available}`;
    if (result.attachmentErrors && result.attachmentErrors.length) {
      text += `\n${result.attachmentErrors.join("\n")}`;
    }
  }
  return text;
}

function applySaveResult(result) {
  if (result && result.ok) {
    const failedAtt = result.wanted && result.available && result.count === 0;
    setStatus(formatSaved(result), failedAtt ? "err" : "ok");
    return;
  }
  setStatus((result && result.error) || t.failed, "err");
}

function addGroup(title, items, kind) {
  if (!items.length) {
    return;
  }
  const label = document.createElement("div");
  label.className = "group";
  label.textContent = title;
  groups.appendChild(label);
  const list = document.createElement("div");
  list.className = "list";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dest";
    button.innerHTML = `<span class="title"></span><span class="sub"></span>`;
    button.querySelector(".title").textContent = item.title;
    button.querySelector(".sub").textContent = item.sub;
    button.addEventListener("click", () => saveTo(item.path, kind));
    list.appendChild(button);
  }
  groups.appendChild(list);
}

async function saveTo(dir, source) {
  setStatus("", "");
  const result = await browser.runtime.sendMessage({
    type: "dest-save",
    dir,
    includeAttachments: attBox.checked,
    source
  });
  applySaveResult(result);
}

manageBtn.addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "dest-manage" });
});

browseBtn.addEventListener("click", async () => {
  setStatus("", "");
  const result = await browser.runtime.sendMessage({
    type: "dest-browse",
    includeAttachments: attBox.checked
  });
  if (result && result.cancelled) {
    setStatus(t.cancelled, "");
    return;
  }
  applySaveResult(result);
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
  fileLine.innerHTML = `${t.file}: <code></code>`;
  fileLine.querySelector("code").textContent = data.note.fileName;
  const names = data.attachmentNames || [];
  attBox.checked = Boolean(data.includeAttachments) && names.length > 0;
  attBox.disabled = names.length === 0;
  attLabel.textContent =
    names.length === 0
      ? t.attNone
      : `${t.att}（${names.length}: ${names.join(", ")}）`;

  const pins = (data.pins || []).map((item) => ({
    title: item.name || item.path,
    sub: item.path,
    path: item.path
  }));
  const used = new Set(pins.map((item) => String(item.path).replace(/[\\/]+$/, "").toLowerCase()));
  const obsidian = (data.obsidian || [])
    .filter((item) => !used.has(String(item.folderAbs).replace(/[\\/]+$/, "").toLowerCase()))
    .map((item) => ({
      title: item.folderRel || item.vaultName,
      sub: item.folderAbs,
      path: item.folderAbs
    }));
  obsidian.forEach((item) => used.add(String(item.path).replace(/[\\/]+$/, "").toLowerCase()));
  const recent = (data.recents || [])
    .filter((path) => !used.has(String(path).replace(/[\\/]+$/, "").toLowerCase()))
    .map((path) => ({
      title: path.split(/[\\/]/).filter(Boolean).slice(-3).join(" / "),
      sub: path,
      path
    }));
  addGroup(t.pinned, pins, "pinned");
  addGroup(t.openNow, obsidian, "obsidian");
  addGroup(t.recent, recent, "recent");
  if (!pins.length && !obsidian.length && !recent.length) {
    const empty = document.createElement("div");
    empty.className = "group";
    empty.textContent = t.empty;
    groups.appendChild(empty);
  }
})();
