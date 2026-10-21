const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "htmlToMarkdown.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "note.js"), "utf8"), ctx);

const note = ctx.MailNote.buildNote({
  message: {
    subject: "Re: 見積依頼",
    date: new Date(2026, 9, 21, 14, 26, 0),
    author: "a@example.com",
    recipients: ["me@example.com"],
    ccList: ["b@example.com"],
    bccList: [],
    headerMessageId: "<abc@example.com>"
  },
  fullMessage: {
    parts: [{ contentType: "text/html", body: "<p>Hello <b>world</b></p>" }]
  },
  attachments: [{ name: "quote.pdf" }]
});

if (note.fileName !== "2026-10-21_見積依頼.md") {
  throw new Error("Unexpected file name: " + note.fileName);
}
if (!note.markdown.includes("has_attachments: true")) {
  throw new Error("Missing attachment property");
}
if (!note.markdown.includes("**world**")) {
  throw new Error("HTML was not converted: " + note.markdown);
}
if (!note.markdown.includes("subject: 見積依頼") && !note.markdown.includes('subject: "Re: 見積依頼"')) {
  throw new Error("Subject missing from properties");
}
console.log(note.fileName);
console.log(note.markdown);
console.log("ok");
