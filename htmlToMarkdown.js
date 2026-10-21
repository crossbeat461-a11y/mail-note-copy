/**
 * Lightweight HTML → Markdown for email bodies.
 */
(function (root) {
  const BLOCK_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul"
  ]);

  function decodeEntities(text) {
    return String(text)
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }

  function collapseBlankLines(text) {
    return text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function attr(tag, name) {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    if (!match) {
      return "";
    }
    return decodeEntities(match[2] || match[3] || match[4] || "");
  }

  function htmlToMarkdown(html) {
    if (!html) {
      return "";
    }

    let source = String(html)
      .replace(/\r\n?/g, "\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "");

    source = source.replace(/<br\s*\/?>/gi, "\n");
    source = source.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

    source = source.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
      const hashes = "#".repeat(Number(level));
      return `\n\n${hashes} ${htmlToMarkdown(inner)}\n\n`;
    });

    source = source.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
      const text = htmlToMarkdown(inner).trim();
      return text ? `**${text}**` : "";
    });
    source = source.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
      const text = htmlToMarkdown(inner).trim();
      return text ? `*${text}*` : "";
    });
    source = source.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
      return "`" + decodeEntities(inner.replace(/<[^>]+>/g, "")).replace(/`/g, "'") + "`";
    });
    source = source.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, ""));
      return `\n\n\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
    });
    source = source.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, raw, inner) => {
      const href = attr(`<a ${raw}>`, "href");
      const text = htmlToMarkdown(inner).trim() || href;
      if (!href || href.startsWith("javascript:")) {
        return text;
      }
      return `[${text}](${href})`;
    });
    source = source.replace(/<img\b([^>]*)\/?>/gi, (_, raw) => {
      const tag = `<img ${raw}>`;
      const alt = attr(tag, "alt") || "image";
      const src = attr(tag, "src");
      if (!src || src.startsWith("cid:")) {
        return alt ? `*[${alt}]*` : "";
      }
      return `![${alt}](${src})`;
    });

    source = source.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const quoted = htmlToMarkdown(inner)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return `\n\n${quoted}\n\n`;
    });

    source = source.replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi, (_, type, inner) => {
      let index = 0;
      const items = [];
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, item) => {
        index += 1;
        const bullet = type.toLowerCase() === "ol" ? `${index}.` : "-";
        const text = htmlToMarkdown(item).trim().replace(/\n/g, "\n  ");
        items.push(`${bullet} ${text}`);
        return "";
      });
      return `\n\n${items.join("\n")}\n\n`;
    });

    source = source.replace(/<p[^>]*>/gi, "\n\n");
    source = source.replace(/<\/p>/gi, "\n\n");
    source = source.replace(/<div[^>]*>/gi, "\n");
    source = source.replace(/<\/div>/gi, "\n");
    source = source.replace(/<\/?(tr)[^>]*>/gi, "\n");
    source = source.replace(/<\/(td|th)[^>]*>/gi, " | ");
    source = source.replace(/<(td|th)[^>]*>/gi, "");

    source = source.replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => {
      const name = tag.replace(/[<\/>]/g, "").split(/\s+/)[0].toLowerCase();
      return BLOCK_TAGS.has(name) ? "\n" : "";
    });

    return collapseBlankLines(decodeEntities(source));
  }

  root.htmlToMarkdown = htmlToMarkdown;
})(typeof window !== "undefined" ? window : this);
