/* global ChromeUtils, ExtensionAPI, IOUtils, PathUtils, Cc, Ci, Services */

var { ExtensionCommon } = (() => {
  try {
    return ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
  } catch (e) {
    return ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
  }
})();

function createLocalFile(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

function getMailWindow() {
  return (
    Services.wm.getMostRecentWindow("mail:3pane") ||
    Services.wm.getMostRecentWindow("mail:messageWindow") ||
    Services.wm.getMostRecentWindow(null)
  );
}

function initFilePicker(fp, title, mode) {
  const win = getMailWindow();
  if (!win) {
    throw new Error("No Thunderbird window");
  }
  try {
    fp.init(win.browsingContext, title, mode);
  } catch (e) {
    fp.init(win, title, mode);
  }
}

function openFilePicker(fp) {
  if (typeof fp.open === "function") {
    return new Promise((resolve) => fp.open(resolve));
  }
  return Promise.resolve(fp.show());
}

function dirServicePath(key) {
  return Services.dirsvc.get(key, Ci.nsIFile).path;
}

function vaultNameFromPath(vaultPath) {
  return String(vaultPath).replace(/[\\/]+$/, "").split(/[\\/]/).pop() || vaultPath;
}

function collectWorkspaceFiles(node, activeId, found) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (activeId && node.id === activeId && node.state && node.state.file) {
    found.push(node.state.file);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectWorkspaceFiles(child, activeId, found);
    }
  }
}

function folderFromNotePath(filePath) {
  if (!filePath) {
    return "";
  }
  const normalized = String(filePath).replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

async function findObsidianJson() {
  const candidates = [];
  try {
    candidates.push(PathUtils.join(dirServicePath("AppData"), "obsidian", "obsidian.json"));
  } catch (e) {
    /* ignore */
  }
  try {
    const home = dirServicePath("Home");
    candidates.push(PathUtils.join(home, "Library", "Application Support", "obsidian", "obsidian.json"));
    candidates.push(PathUtils.join(home, ".config", "obsidian", "obsidian.json"));
  } catch (e) {
    /* ignore */
  }
  for (const candidate of candidates) {
    if (await IOUtils.exists(candidate)) {
      return candidate;
    }
  }
  return "";
}

async function readWorkspaceFolder(vaultPath) {
  for (const name of ["workspace.json", "workspace-mobile.json"]) {
    const workspacePath = PathUtils.join(vaultPath, ".obsidian", name);
    if (!(await IOUtils.exists(workspacePath))) {
      continue;
    }
    try {
      const data = JSON.parse(await IOUtils.readUTF8(workspacePath));
      const found = [];
      if (data.active) {
        collectWorkspaceFiles(data, data.active, found);
        collectWorkspaceFiles(data.main, data.active, found);
        collectWorkspaceFiles(data.left, data.active, found);
        collectWorkspaceFiles(data.right, data.active, found);
        collectWorkspaceFiles(data.floating, data.active, found);
      }
      let file = found[0];
      if (!file && Array.isArray(data.lastOpenFiles) && data.lastOpenFiles.length) {
        file = data.lastOpenFiles[0];
      }
      return folderFromNotePath(file);
    } catch (e) {
      /* ignore broken workspace */
    }
  }
  return "";
}

async function detectObsidianTargets() {
  const jsonPath = await findObsidianJson();
  if (!jsonPath) {
    return [];
  }
  const data = JSON.parse(await IOUtils.readUTF8(jsonPath));
  const vaults = Object.values(data.vaults || {}).filter((vault) => vault && vault.path);
  vaults.sort((a, b) => {
    if (a.open && !b.open) {
      return -1;
    }
    if (!a.open && b.open) {
      return 1;
    }
    return (b.ts || 0) - (a.ts || 0);
  });

  const targets = [];
  for (const vault of vaults.slice(0, 6)) {
    if (!(await IOUtils.exists(vault.path))) {
      continue;
    }
    const folderRel = await readWorkspaceFolder(vault.path);
    let folderAbs = vault.path;
    if (folderRel) {
      const joined = PathUtils.join(vault.path, ...folderRel.split("/").filter(Boolean));
      if (await IOUtils.exists(joined)) {
        folderAbs = joined;
      }
    }
    const vaultName = vaultNameFromPath(vault.path);
    targets.push({
      vaultName,
      vaultPath: vault.path,
      folderAbs,
      folderRel: folderRel || "",
      label: folderRel ? `${vaultName} / ${folderRel}` : vaultName
    });
  }
  return targets;
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

this.mailNoteFiles = class extends ExtensionCommon.ExtensionAPI {
  getAPI() {
    return {
      mailNoteFiles: {
        async getTempDir() {
          const root = PathUtils.join(PathUtils.tempDir, "mail-note-copy");
          await IOUtils.makeDirectory(root, { ignoreExisting: true });
          const dir = PathUtils.join(root, `note_${Date.now()}`);
          await IOUtils.makeDirectory(dir);
          return dir;
        },

        async writeTextFile(path, contents) {
          await IOUtils.writeUTF8(path, contents);
        },

        async writeBase64File(path, base64) {
          await IOUtils.write(path, decodeBase64(base64));
        },

        async moveFile(from, to) {
          try {
            await IOUtils.move(from, to);
          } catch (e) {
            await IOUtils.copy(from, to);
            try {
              await IOUtils.remove(from);
            } catch (removeErr) {
              /* keep the temp copy if remove fails */
            }
          }
          const stat = await IOUtils.stat(to);
          return { size: stat.size || 0 };
        },

        async fileSize(path) {
          try {
            const stat = await IOUtils.stat(path);
            return stat.size || 0;
          } catch (e) {
            return 0;
          }
        },

        async writeBytes(path, data) {
          const bytes =
            data instanceof Uint8Array
              ? data
              : data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : Array.isArray(data)
                  ? Uint8Array.from(data)
                  : decodeBase64(String(data || ""));
          await IOUtils.write(path, bytes);
        },

        async pickSavePath(defaultFileName, title, lastDir) {
          const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
          initFilePicker(fp, title || "Save mail note", Ci.nsIFilePicker.modeSave);
          fp.appendFilter("Markdown", "*.md");
          fp.appendFilters(Ci.nsIFilePicker.filterAll);
          fp.defaultExtension = "md";
          fp.defaultString = defaultFileName || "note.md";
          if (lastDir) {
            try {
              fp.displayDirectory = createLocalFile(lastDir);
            } catch (e) {
              /* ignore missing folder */
            }
          }

          const result = await openFilePicker(fp);
          if (
            result !== Ci.nsIFilePicker.returnOK &&
            result !== Ci.nsIFilePicker.returnReplace
          ) {
            return "";
          }

          let path = fp.file.path;
          if (!/\.md$/i.test(path)) {
            path += ".md";
          }
          return path;
        },

        async pickFolder(title, lastDir) {
          const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
          initFilePicker(fp, title || "Choose folder", Ci.nsIFilePicker.modeGetFolder);
          if (lastDir) {
            try {
              fp.displayDirectory = createLocalFile(lastDir);
            } catch (e) {
              /* ignore */
            }
          }
          const result = await openFilePicker(fp);
          if (result !== Ci.nsIFilePicker.returnOK) {
            return "";
          }
          return fp.file.path;
        },

        async pathExists(path) {
          try {
            return await IOUtils.exists(path);
          } catch (e) {
            return false;
          }
        },

        async detectObsidianTargets() {
          return detectObsidianTargets();
        },

        async revealPath(path) {
          const file = createLocalFile(path);
          if (typeof file.reveal === "function") {
            file.reveal();
            return;
          }
          if (file.parent && typeof file.parent.launch === "function") {
            file.parent.launch();
          }
        },

        async copyText(text) {
          const helper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
            Ci.nsIClipboardHelper
          );
          helper.copyString(text);
        },

        async copyFiles(paths) {
          if (!paths || !paths.length) {
            throw new Error("No files to copy");
          }

          const files = paths.map((path) => createLocalFile(path));

          const putOnClipboard = (data) => {
            const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(
              Ci.nsITransferable
            );
            transferable.init(null);
            transferable.addDataFlavor("application/x-moz-file");
            transferable.setTransferData("application/x-moz-file", data);
            Services.clipboard.setData(
              transferable,
              null,
              Services.clipboard.kGlobalClipboard
            );
          };

          if (files.length === 1) {
            putOnClipboard(files[0]);
            return;
          }

          try {
            const list = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
            for (const file of files) {
              list.appendElement(file);
            }
            putOnClipboard(list);
          } catch (err) {
            putOnClipboard(files[0].parent || files[0]);
          }
        }
      }
    };
  }
};
