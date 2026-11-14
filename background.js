/** Mail Note Copy 1.1.1 */

const MENU_COPY_BODY = "copy-body";
const MENU_SAVE_NOTE = "save-note";
const MENU_SAVE_NOTE_ATTACHMENTS = "save-note-attachments";

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
});

function baseName(filePath) {
  const parts = String(filePath).split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

let pendingSave = null;
let pendingCopyText = "";

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

async function showFinishPopup(reason, extra) {
  const params = new URLSearchParams({
    reason: reason || "failed",
    file: extra && extra.file ? extra.file : "",
    path: extra && extra.path ? extra.path : "",
    count: extra && extra.count != null ? String(extra.count) : "0",
    downloadId: extra && extra.downloadId != null ? String(extra.downloadId) : ""
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

function copyMarkdownText(markdown) {
  pendingCopyText = markdown;
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
    return already[0];
  }
  if (already[0] && already[0].state === "interrupted") {
    throw new Error("cancelled");
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
        browser.downloads.search({ id: downloadId }).then((items) => resolve(items[0] || null));
      } else if (delta.state && delta.state.current === "interrupted") {
        clearTimeout(timer);
        browser.downloads.onChanged.removeListener(onChange);
        reject(new Error("cancelled"));
      }
    }

    browser.downloads.onChanged.addListener(onChange);
  });
}

async function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  let downloadId = null;
  try {
    downloadId = await browser.downloads.download({
      url: objectUrl,
      filename: fileName,
      conflictAction: "uniquify",
      saveAs: true
    });
    const item = await waitForDownload(downloadId);
    return {
      id: downloadId,
      filename: item && item.filename ? item.filename : fileName
    };
  } catch (err) {
    if (downloadId != null) {
      try {
        await browser.downloads.erase({ id: downloadId });
      } catch (e) {
        /* ignore */
      }
    }
    throw err;
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}

async function listAttachmentsForSave(ctx) {
  let attachments = ctx.attachments;
  try {
    const fresh = await browser.messages.listAttachments(ctx.message.id);
    attachments = mergeAttachments(fresh, ctx.fullMessage);
  } catch (e) {
    /* keep the attachments collected when the chooser opened */
  }
  return attachments;
}

async function saveWithDialog(includeAttachments) {
  if (!pendingSave) {
    return { ok: false, error: "no pending note" };
  }

  let markdown = pendingSave.note.markdown;
  const wanted = Boolean(includeAttachments);
  const attachments = wanted ? await listAttachmentsForSave(pendingSave.ctx) : [];
  const available = attachments.length;
  const used = new Set([pendingSave.note.fileName.toLowerCase()]);
  const named = [];

  for (const att of attachments) {
    named.push({
      ...att,
      fileName: uniqueName(used, att.name || guessAttachmentName(att, named.length + 1))
    });
  }

  if (named.length) {
    markdown +=
      "\n## 添付\n\n" +
      named.map((item) => `- [[${item.fileName}]]`).join("\n") +
      "\n";
  }

  let noteDownload;
  try {
    noteDownload = await downloadBlob(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      pendingSave.note.fileName
    );
  } catch (err) {
    if (String(err && err.message) === "cancelled") {
      return { cancelled: true };
    }
    throw err;
  }

  let savedAttachments = 0;
  const attachmentErrors = [];
  const savedNames = [];
  for (const att of named) {
    if (!att.partName) {
      attachmentErrors.push((att.name || "attachment") + ": no partName");
      continue;
    }
    try {
      const file = await browser.messages.getAttachmentFile(pendingSave.ctx.message.id, att.partName);
      await downloadBlob(file, att.fileName);
      savedNames.push(att.fileName);
      savedAttachments += 1;
    } catch (err) {
      if (String(err && err.message) === "cancelled") {
        attachmentErrors.push(att.fileName + ": cancelled");
        continue;
      }
      console.error("Attachment save failed:", att.name, err);
      attachmentErrors.push(
        (att.name || att.partName) + ": " + (err && err.message ? err.message : String(err))
      );
    }
  }

  return {
    ok: true,
    file: baseName(noteDownload.filename),
    path: noteDownload.filename,
    downloadId: noteDownload.id,
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
  pendingSave = {
    ctx,
    note: MailNote.buildNote(ctx),
    includeAttachments
  };
  await browser.windows.create({
    url: "dest.html",
    type: "popup",
    width: 520,
    height: 420
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
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "dest-ready") {
    const attachments = pendingSave ? pendingSave.ctx.attachments : [];
    return Promise.resolve({
      note: pendingSave && pendingSave.note,
      includeAttachments: pendingSave
        ? pendingSave.includeAttachments || attachments.length > 0
        : false,
      attachmentCount: attachments.length,
      attachmentNames: attachments.map((item) => item.name).filter(Boolean)
    });
  }
  if (message.type === "dest-save") {
    return saveWithDialog(message.includeAttachments);
  }
  if (message.type === "finish-copy") {
    const text = pendingCopyText;
    pendingCopyText = "";
    return Promise.resolve({ text });
  }
  return undefined;
});
