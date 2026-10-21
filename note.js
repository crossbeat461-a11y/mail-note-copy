(function (root) {
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function asDate(value) {
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatDay(date) {
    const d = asDate(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDateTimeISO(date) {
    const d = asDate(date);
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
      `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
    );
  }

  function stripReplyPrefix(subject) {
    let text = String(subject || "").trim();
    const prefix = /^(re|fwd|fw|aw|sv|res|ref)\s*:\s*/i;
    for (let i = 0; i < 8 && prefix.test(text); i++) {
      text = text.replace(prefix, "").trim();
    }
    return text;
  }

  function sanitizeFilePart(text, maxLength) {
    const cleaned = String(text || "")
      .replace(/[\\/:*?"<>|\r\n]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, maxLength || 60);
    return cleaned || "no-subject";
  }

  function yamlScalar(value) {
    if (value == null) {
      return '""';
    }
    const text = String(value);
    if (text === "") {
      return '""';
    }
    if (/[:#\n"'\\[\]{}&*?|><%`]/.test(text) || text !== text.trim() || text !== text.replace(/\s+/g, " ")) {
      return JSON.stringify(text);
    }
    return text;
  }

  function yamlList(values) {
    if (!values || !values.length) {
      return "[]";
    }
    return values.map((item) => `\n  - ${yamlScalar(item)}`).join("");
  }

  function asList(value) {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value.filter(Boolean) : [value];
  }

  function collectBody(part, found) {
    if (!part) {
      return;
    }
    const type = String(part.contentType || "").toLowerCase();
    if (part.body && type.startsWith("text/html") && !found.html) {
      found.html = part.body;
    }
    if (part.body && type.startsWith("text/plain") && !found.plain) {
      found.plain = part.body;
    }
    if (part.parts) {
      for (const child of part.parts) {
        collectBody(child, found);
      }
    }
  }

  function extractBodies(fullMessage) {
    const found = { html: "", plain: "" };
    if (fullMessage && fullMessage.parts) {
      for (const part of fullMessage.parts) {
        collectBody(part, found);
      }
    }
    return found;
  }

  function buildNote({ message, fullMessage, attachments }) {
    const subject = message.subject || "";
    const date = message.date;
    const attachNames = (attachments || [])
      .map((item) => item.name)
      .filter(Boolean);
    const bodies = extractBodies(fullMessage);
    const converter = root.htmlToMarkdown;
    const body = bodies.html && converter
      ? converter(bodies.html)
      : (bodies.plain || "").trim();

    const fileStem = `${formatDay(date)}_${sanitizeFilePart(stripReplyPrefix(subject))}`;
    const markdown =
      "---\n" +
      `date: ${yamlScalar(formatDateTimeISO(date))}\n` +
      `from: ${yamlScalar(message.author || "")}\n` +
      `to: ${yamlList(asList(message.recipients))}\n` +
      `cc: ${yamlList(asList(message.ccList))}\n` +
      `bcc: ${yamlList(asList(message.bccList))}\n` +
      `subject: ${yamlScalar(subject)}\n` +
      `has_attachments: ${attachNames.length > 0 ? "true" : "false"}\n` +
      `attachments: ${yamlList(attachNames)}\n` +
      `message-id: ${yamlScalar(message.headerMessageId || "")}\n` +
      "---\n\n" +
      (body || "_(no body)_") +
      "\n";

    return {
      fileStem,
      fileName: `${fileStem}.md`,
      markdown,
      attachmentNames: attachNames
    };
  }

  root.MailNote = {
    formatDay,
    formatDateTimeISO,
    stripReplyPrefix,
    sanitizeFilePart,
    extractBodies,
    buildNote
  };
})(typeof window !== "undefined" ? window : this);
