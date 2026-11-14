const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "htmlToMarkdown.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "note.js"), "utf8"), ctx);

function noteMessage() {
  return {
    subject: "Re: 見積依頼",
    date: new Date(2026, 9, 21, 14, 26, 0),
    author: "a@example.com",
    recipients: ["me@example.com"],
    ccList: ["b@example.com"],
    bccList: [],
    headerMessageId: "<abc@example.com>"
  };
}

const note = ctx.MailNote.buildNote({
  message: noteMessage(),
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

const both = ctx.MailNote.buildNote({
  message: noteMessage(),
  fullMessage: {
    parts: [
      { contentType: "text/plain", body: "plain body\n" },
      { contentType: "text/html", body: "<p>Hello <b>world</b></p>" }
    ]
  },
  attachments: []
});
if (!both.markdown.includes("plain body")) {
  throw new Error("Plain body was not used: " + both.markdown);
}
if (both.markdown.includes("**world**")) {
  throw new Error("HTML was used when plain exists: " + both.markdown);
}

const tableHtml = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<table><tr><td></td><td>Joe 様</td></tr><tr><td>次回のお支払い</td></tr></table>`;
const tableMd = ctx.htmlToMarkdown(tableHtml);
if (tableMd.includes("<!DOCTYPE")) {
  throw new Error("DOCTYPE remained: " + tableMd);
}
if (tableMd.includes("|")) {
  throw new Error("Table pipes remained: " + tableMd);
}
if (!tableMd.includes("Joe 様") || !tableMd.includes("次回のお支払い")) {
  throw new Error("Table text missing: " + tableMd);
}

console.log(note.fileName);
console.log(note.markdown);
console.log("ok");
