const heading = document.getElementById("heading");
const lead = document.getElementById("lead");
const empty = document.getElementById("empty");
const list = document.getElementById("list");
const addBtn = document.getElementById("addBtn");
const closeBtn = document.getElementById("closeBtn");
const status = document.getElementById("status");
const langKey = (browser.i18n.getUILanguage() || "en").substring(0, 2);

const t = {
  ja: {
    heading: "保存先の管理",
    lead: "よく使うフォルダを追加・削除できます。登録した場所は保存画面の一番上に残ります。空のままでも最近使った場所だけで使えます。",
    empty: "まだ固定の保存先はありません。「フォルダを追加」で選んでください。",
    add: "フォルダを追加…",
    close: "閉じる",
    remove: "この保存先を削除",
    name: "表示名",
    added: "追加しました。",
    removed: "削除しました。",
    renamed: "名前を更新しました。",
    cancelled: "キャンセルしました。",
    duplicate: "同じフォルダはすでに登録されています。",
    limit: "固定の保存先は 16 件までです。",
    failed: "操作に失敗しました。"
  },
  en: {
    heading: "Manage destinations",
    lead: "Add or remove pinned folders. They stay at the top of the save window. Recents still work if you add nothing.",
    empty: "No pinned folders yet. Click Add folder to choose one.",
    add: "Add folder…",
    close: "Close",
    remove: "Remove this folder",
    name: "Label",
    added: "Added.",
    removed: "Removed.",
    renamed: "Name updated.",
    cancelled: "Cancelled.",
    duplicate: "That folder is already pinned.",
    limit: "You can pin up to 16 folders.",
    failed: "That action failed."
  }
}[langKey === "ja" ? "ja" : "en"];

heading.textContent = t.heading;
lead.textContent = t.lead;
empty.textContent = t.empty;
addBtn.textContent = t.add;
closeBtn.textContent = t.close;

function setStatus(text, kind) {
  status.textContent = text || "";
  status.className = kind || "";
}

function render(pins) {
  list.innerHTML = "";
  empty.hidden = pins.length > 0;
  for (const pin of pins) {
    const card = document.createElement("div");
    card.className = "pin";
    const top = document.createElement("div");
    top.className = "pin-top";
    const input = document.createElement("input");
    input.type = "text";
    input.value = pin.name || "";
    input.setAttribute("aria-label", t.name);
    input.addEventListener("change", async () => {
      const result = await browser.runtime.sendMessage({
        type: "pins-rename",
        id: pin.id,
        name: input.value
      });
      setStatus(result && result.ok ? t.renamed : t.failed, result && result.ok ? "ok" : "err");
    });
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = t.remove;
    remove.addEventListener("click", async () => {
      const result = await browser.runtime.sendMessage({ type: "pins-remove", id: pin.id });
      if (result && result.ok) {
        setStatus(t.removed, "ok");
        render(result.pins || []);
        return;
      }
      setStatus(t.failed, "err");
    });
    top.appendChild(input);
    top.appendChild(remove);
    const path = document.createElement("div");
    path.className = "path";
    path.textContent = pin.path;
    card.appendChild(top);
    card.appendChild(path);
    list.appendChild(card);
  }
}

addBtn.addEventListener("click", async () => {
  setStatus("", "");
  const result = await browser.runtime.sendMessage({ type: "pins-add" });
  if (result && result.cancelled) {
    setStatus(t.cancelled, "");
    return;
  }
  if (result && result.ok) {
    setStatus(t.added, "ok");
    render(result.pins || []);
    return;
  }
  const reason = result && result.error;
  setStatus(t[reason] || t.failed, "err");
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
  const result = await browser.runtime.sendMessage({ type: "pins-get" });
  render((result && result.pins) || []);
})();
