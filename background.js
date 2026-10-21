/** Mail Note Copy 1.0.0 */

const MENU_COPY_BODY = "copy-body";
const MENU_SAVE_NOTE = "save-note";
const MENU_SAVE_NOTE_ATTACHMENTS = "save-note-attachments";
const MENU_MANAGE_PINS = "manage-pins";
const MAX_PINS = 16;

browser.menus.removeAll().then(() => {
  browser.menus.create({
    id: MENU_COPY_BODY,
    title: browser.i18n.getMessage("menuCopyBody") || "Copy body",
    contexts: ["all"]
  });
  browser.menus.create({
    id: MENU_SAVE_NOTE,
    title: browser.i18n.getMessage("menuSaveNote") || "Save note…",
    contexts: ["all"]
  });
  browser.menus.create({
    id: MENU_SAVE_NOTE_ATTACHMENTS,
    title: browser.i18n.getMessage("menuSaveNoteAttachments") || "Save note and attachments…",
    contexts: ["all"]
  });
  browser.menus.create({
    id: MENU_MANAGE_PINS,
    title: browser.i18n.getMessage("menuManagePins") || "Manage destinations…",
    contexts: ["all"]
  });
});

function joinPath(dir, name) {
  const sep = String(dir).includes("\\") ? "\\" : "/";
  return String(dir).replace(/[\\/]+$/, "") + sep + name;
}

function parentDir(filePath) {
  return String(filePath).replace(/[\\/][^\\/]+$/, "");
}

function baseName(filePath) {
  const parts = String(filePath).split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

let pendingSave = null;

async function getRecentDirs() {
  try {
    const stored = await browser.storage.local.get(["recentDirs", "lastSaveDir"]);
    const recents = Array.isArray(stored.recentDirs) ? stored.recentDirs.slice() : [];
    if (stored.lastSaveDir && !recents.includes(stored.lastSaveDir)) {
      recents.unshift(stored.lastSaveDir);
    }
    return recents.filter(Boolean).slice(0, 8);
  } catch (e) {
    return [];
  }
}

async function rememberDir(dir) {
  if (!dir) {
    return;
  }
  const recents = (await getRecentDirs()).filter((item) => item !== dir);
  recents.unshift(dir);
  try {
    await browser.storage.local.set({
      lastSaveDir: dir,
      recentDirs: recents.slice(0, 8)
    });
  } catch (e) {
    /* ignore */
  }
}

async function getLastSaveDir() {
  const recents = await getRecentDirs();
  return recents[0] || "";
}

function normalizeDir(dir) {
  return String(dir || "").replace(/[\\/]+$/, "").toLowerCase();
}

function defaultPinName(path) {
  const parts = String(path || "").split(/[\\/]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(" / ");
  }
  return parts[0] || path;
}

async function getPinnedFolders() {
  try {
    const stored = await browser.storage.local.get("pinnedFolders");
    const list = Array.isArray(stored.pinnedFolders) ? stored.pinnedFolders : [];
    return list.filter((item) => item && item.path);
  } catch (e) {
    return [];
  }
}

async function setPinnedFolders(list) {
  await browser.storage.local.set({ pinnedFolders: list });
  return list;
}

async function addPinnedFolder(path, name) {
  if (!path) {
    return { ok: false, cancelled: true };
  }
  const pins = await getPinnedFolders();
  if (pins.some((pin) => normalizeDir(pin.path) === normalizeDir(path))) {
    return { ok: false, error: "duplicate", pins };
  }
  if (pins.length >= MAX_PINS) {
    return { ok: false, error: "limit", pins };
  }
  pins.push({
    id: "pin_" + Date.now(),
    name: (name || defaultPinName(path)).trim() || defaultPinName(path),
    path
  });
  await setPinnedFolders(pins);
  return { ok: true, pins };
}

async function openPinsWindow() {
  await browser.windows.create({
    url: "options.html",
    type: "popup",
    width: 560,
    height: 640
  });
}

function guessAttachmentName(part, index) {
  if (part && part.name) {
    return part.name;
  }
  const type = String((part && part.contentType) || "").split(";")[0].trim().toLowerCase();
  const ext = {
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "text/calendar": ".ics"
  }[type] || "";
  return `attachment_${index}${ext}`;
}

function isSkippablePart(part) {
  const type = String((part && part.contentType) || "").split(";")[0].trim().toLowerCase();
  return (
    !type ||
    type.startsWith("multipart/") ||
    type === "text/plain" ||
    type === "text/html"
  );
}

function collectParts(part, found) {
  if (!part) {
    return;
  }
  if (part.parts && part.parts.length) {
    for (const child of part.parts) {
      collectParts(child, found);
    }
    return;
  }
  if (!part.partName || isSkippablePart(part)) {
    return;
  }
  found.push({
    name: part.name || "",
    partName: part.partName,
    contentType: part.contentType || ""
  });
}

function mergeAttachments(listed, fullMessage) {
  const map = new Map();
  const raw = Array.isArray(listed)
    ? listed
    : listed && Array.isArray(listed.attachments)
      ? listed.attachments
      : [];
  for (const att of raw) {
    const partName = att && (att.partName || att.part || att.id);
    if (!partName) {
      continue;
    }
    map.set(String(partName), {
      name: att.name || "",
      partName: String(partName),
      contentType: att.contentType || ""
    });
  }
  if (fullMessage) {
    const fromFull = [];
    collectParts(fullMessage, fromFull);
    for (const att of fromFull) {
      if (!map.has(att.partName)) {
        map.set(att.partName, att);
      }
    }
  }
  return Array.from(map.values()).map((att, index) => ({
    ...att,
    name: att.name || guessAttachmentName(att, index + 1)
  }));
}

async function readFileBuffer(file) {
  if (file && typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsArrayBuffer(file);
  });
}

function uniqueName(used, rawName) {
  const safe = MailNote.sanitizeFilePart(rawName, 80);
  const key = safe.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return safe;
  }
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let index = 2;
  let next = `${base}_${index}${ext}`;
  while (used.has(next.toLowerCase())) {
    index += 1;
    next = `${base}_${index}${ext}`;
  }
  used.add(next.toLowerCase());
  return next;
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function showFinishPopup(reason, extra) {
  const params = new URLSearchParams({
    reason: reason || "failed",
    file: extra && extra.file ? extra.file : "",
    path: extra && extra.path ? extra.path : "",
    count: extra && extra.count != null ? String(extra.count) : "0"
  });
  await browser.windows.create({
    url: `finish.html?${params.toString()}`,
    type: "popup",
    width: 460,
    height: reason && (reason.startsWith("copied") || reason.startsWith("saved")) ? 280 : 300
  });
}

async function resolveMessage(tab, info) {
  const selected = info && info.selectedMessages && info.selectedMessages.messages;
  if (selected && selected.length) {
    return selected[0];
  }

  if (tab && tab.id != null) {
    try {
      const displayed = await browser.messageDisplay.getDisplayedMessage(tab.id);
      if (displayed) {
        return displayed;
      }
    } catch (e) {
      /* not a message display tab */
    }
    try {
      const list = await browser.mailTabs.getSelectedMessages(tab.id);
      if (list && list.messages && list.messages.length) {
        return list.messages[0];
      }
    } catch (e) {
      /* not a mail tab */
    }
  }

  const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
  if (mailTabs[0]) {
    try {
      const list = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
      if (list && list.messages && list.messages.length) {
        return list.messages[0];
      }
    } catch (e) {
      /* ignore */
    }
    try {
      const displayed = await browser.messageDisplay.getDisplayedMessage(mailTabs[0].id);
      if (displayed) {
        return displayed;
      }
    } catch (e) {
      /* ignore */
    }
  }

  return null;
}

async function loadNoteContext(tab, info) {
  const header = await resolveMessage(tab, info);
  if (!header) {
    return null;
  }
  const [message, fullMessage, attachments] = await Promise.all([
    browser.messages.get(header.id),
    browser.messages.getFull(header.id),
    browser.messages.listAttachments(header.id)
  ]);
  return {
    message,
    fullMessage,
    attachments: mergeAttachments(attachments, fullMessage)
  };
}

async function copyTextFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) {
    throw new Error("clipboard fallback failed");
  }
}

async function copyMarkdownText(markdown) {
  if (browser.mailNoteFiles && browser.mailNoteFiles.copyText) {
    await browser.mailNoteFiles.copyText(markdown);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(markdown);
    return;
  }
  await copyTextFallback(markdown);
}

async function copyBody(tab, info) {
  const ctx = await loadNoteContext(tab, info);
  if (!ctx) {
    await showFinishPopup("no_message");
    return;
  }
  const note = MailNote.buildNote(ctx);
  await copyMarkdownText(note.markdown);
  await showFinishPopup("copied_body", { file: note.fileName });
}

async function waitForDownload(downloadId) {
  const already = await browser.downloads.search({ id: downloadId });
  if (already[0] && already[0].state === "complete") {
    return;
  }
  if (already[0] && already[0].state === "interrupted") {
    throw new Error("download interrupted");
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.downloads.onChanged.removeListener(onChange);
      reject(new Error("download timeout"));
    }, 120000);

    function onChange(delta) {
      if (delta.id !== downloadId) {
        return;
      }
      if (delta.state && delta.state.current === "complete") {
        clearTimeout(timer);
        browser.downloads.onChanged.removeListener(onChange);
        resolve();
      } else if (delta.state && delta.state.current === "interrupted") {
        clearTimeout(timer);
        browser.downloads.onChanged.removeListener(onChange);
        reject(new Error("download interrupted"));
      }
    }

    browser.downloads.onChanged.addListener(onChange);
  });
}

async function downloadThenMove(file, dest) {
  const objectUrl = URL.createObjectURL(file);
  let downloadId = null;
  try {
    downloadId = await browser.downloads.download({
      url: objectUrl,
      filename: "MailNoteCopyTemp/" + baseName(dest),
      conflictAction: "uniquify",
      saveAs: false
    });
    await waitForDownload(downloadId);
    const items = await browser.downloads.search({ id: downloadId });
    const downloaded = items && items[0] && items[0].filename;
    if (!downloaded) {
      throw new Error("download path missing");
    }
    const moved = await browser.mailNoteFiles.moveFile(downloaded, dest);
    if (!moved || !moved.size) {
      throw new Error("moved file is empty");
    }
    try {
      await browser.downloads.erase({ id: downloadId });
    } catch (e) {
      /* ignore */
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}

async function writeAttachmentFile(dest, file) {
  try {
    await downloadThenMove(file, dest);
    return;
  } catch (err) {
    console.warn("download-then-move failed, falling back:", err);
  }
  await browser.mailNoteFiles.writeBase64File(dest, await fileToBase64(file));
  const size = await browser.mailNoteFiles.fileSize(dest);
  if (!size) {
    throw new Error("written file is empty");
  }
}

async function writeAttachmentsBeside(messageId, attachments, directory, used) {
  let saved = 0;
  const paths = [];
  const names = [];
  const errors = [];
  for (const att of attachments) {
    if (!att.partName) {
      errors.push((att.name || "attachment") + ": no partName");
      continue;
    }
    try {
      const file = await browser.messages.getAttachmentFile(messageId, att.partName);
      const fileName = uniqueName(used, att.name || guessAttachmentName(att, saved + 1));
      const dest = joinPath(directory, fileName);
      await writeAttachmentFile(dest, file);
      paths.push(dest);
      names.push(fileName);
      saved += 1;
    } catch (err) {
      console.error("Attachment save failed:", att.name, err);
      errors.push((att.name || att.partName) + ": " + (err && err.message ? err.message : String(err)));
    }
  }
  return { saved, paths, names, errors };
}

async function nextAvailablePath(directory, fileName) {
  let dest = joinPath(directory, fileName);
  if (!(await browser.mailNoteFiles.pathExists(dest))) {
    return dest;
  }
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  let index = 2;
  dest = joinPath(directory, `${stem}_${index}${ext}`);
  while (await browser.mailNoteFiles.pathExists(dest)) {
    index += 1;
    dest = joinPath(directory, `${stem}_${index}${ext}`);
  }
  return dest;
}

async function savePendingToDirectory(directory, includeAttachments) {
  if (!pendingSave) {
    return { ok: false, error: "no pending note" };
  }
  if (!directory) {
    return { ok: false, error: "no folder" };
  }
  if (!(await browser.mailNoteFiles.pathExists(directory))) {
    return { ok: false, error: "folder missing" };
  }

  const destPath = await nextAvailablePath(directory, pendingSave.note.fileName);
  let markdown = pendingSave.note.markdown;
  await rememberDir(directory);

  let savedAttachments = 0;
  let attachmentErrors = [];
  let savedNames = [];
  const wanted = Boolean(includeAttachments);
  let attachments = pendingSave.ctx.attachments;
  try {
    const fresh = await browser.messages.listAttachments(pendingSave.ctx.message.id);
    attachments = mergeAttachments(fresh, pendingSave.ctx.fullMessage);
  } catch (e) {
    /* keep the attachments collected when the chooser opened */
  }
  const available = attachments.length;
  if (wanted && available) {
    const used = new Set([baseName(destPath).toLowerCase()]);
    const written = await writeAttachmentsBeside(
      pendingSave.ctx.message.id,
      attachments,
      directory,
      used
    );
    savedAttachments = written.saved;
    savedNames = written.names || [];
    attachmentErrors = written.errors || [];
    if (savedNames.length) {
      markdown +=
        "\n## 添付\n\n" +
        savedNames.map((name) => `- [[${name}]]`).join("\n") +
        "\n";
    }
  }

  await browser.mailNoteFiles.writeTextFile(destPath, markdown);

  return {
    ok: true,
    file: baseName(destPath),
    path: destPath,
    dir: directory,
    count: savedAttachments,
    wanted,
    available,
    attachmentErrors
  };
}

async function openChooser(tab, info, includeAttachments) {
  const ctx = await loadNoteContext(tab, info);
  if (!ctx) {
    await showFinishPopup("no_message");
    return;
  }
  if (!browser.mailNoteFiles) {
    await copyMarkdownText(MailNote.buildNote(ctx).markdown);
    await showFinishPopup("copied_body_fallback");
    return;
  }
  pendingSave = {
    ctx,
    note: MailNote.buildNote(ctx),
    includeAttachments
  };
  await browser.windows.create({
    url: "dest.html",
    type: "popup",
    width: 540,
    height: 580
  });
}

async function runAction(action, tab, info) {
  try {
    if (action === MENU_COPY_BODY) {
      await copyBody(tab, info);
      return;
    }
    if (action === MENU_SAVE_NOTE_ATTACHMENTS) {
      await openChooser(tab, info, true);
      return;
    }
    await openChooser(tab, info, false);
  } catch (err) {
    console.error("Mail Note Copy failed:", err);
    await showFinishPopup("failed");
  }
}

browser.browserAction.onClicked.addListener((tab) => {
  runAction(MENU_SAVE_NOTE, tab, {});
});

browser.menus.onClicked.addListener((info, tab) => {
  if (
    info.menuItemId === MENU_COPY_BODY ||
    info.menuItemId === MENU_SAVE_NOTE ||
    info.menuItemId === MENU_SAVE_NOTE_ATTACHMENTS
  ) {
    runAction(info.menuItemId, tab, info);
    return;
  }
  if (info.menuItemId === MENU_MANAGE_PINS) {
    openPinsWindow().catch((err) => console.error(err));
  }
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === "dest-ready") {
    let obsidian = [];
    try {
      obsidian = await browser.mailNoteFiles.detectObsidianTargets();
    } catch (e) {
      console.warn("Obsidian detect failed:", e);
    }
    const attachments = pendingSave ? pendingSave.ctx.attachments : [];
    return {
      note: pendingSave && pendingSave.note,
      includeAttachments: pendingSave
        ? pendingSave.includeAttachments || attachments.length > 0
        : false,
      attachmentCount: attachments.length,
      attachmentNames: attachments.map((item) => item.name).filter(Boolean),
      recents: await getRecentDirs(),
      pins: await getPinnedFolders(),
      obsidian
    };
  }
  if (message.type === "dest-save") {
    return savePendingToDirectory(message.dir, message.includeAttachments);
  }
  if (message.type === "dest-browse") {
    const title = browser.i18n.getMessage("saveDialogTitle") || "Save mail note";
    const folder = await browser.mailNoteFiles.pickFolder(title, await getLastSaveDir());
    if (!folder) {
      return { cancelled: true };
    }
    return savePendingToDirectory(folder, message.includeAttachments);
  }
  if (message.type === "dest-manage") {
    await openPinsWindow();
    return { ok: true };
  }
  if (message.type === "pins-get") {
    return { pins: await getPinnedFolders() };
  }
  if (message.type === "pins-add") {
    const title = browser.i18n.getMessage("saveDialogTitle") || "Save mail note";
    const folder = await browser.mailNoteFiles.pickFolder(title, await getLastSaveDir());
    if (!folder) {
      return { cancelled: true };
    }
    return addPinnedFolder(folder);
  }
  if (message.type === "pins-remove") {
    const pins = (await getPinnedFolders()).filter((pin) => pin.id !== message.id);
    await setPinnedFolders(pins);
    return { ok: true, pins };
  }
  if (message.type === "pins-rename") {
    const pins = await getPinnedFolders();
    const target = pins.find((pin) => pin.id === message.id);
    if (!target) {
      return { ok: false, pins };
    }
    target.name = String(message.name || "").trim() || defaultPinName(target.path);
    await setPinnedFolders(pins);
    return { ok: true, pins };
  }
  return null;
});
