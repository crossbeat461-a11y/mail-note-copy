"""Build mail-note-copy-1.0.0.xpi with ZIP entries using forward slashes."""
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "mail-note-copy-1.0.0.xpi")
FILES = [
    "manifest.json",
    "background.js",
    "note.js",
    "htmlToMarkdown.js",
    "dest.html",
    "dest.js",
    "options.html",
    "options.js",
    "finish.html",
    "finish.js",
    "icon.png",
    "LICENSE",
    "README.md",
    "api/implementation.js",
    "api/schema.json",
    "_locales/en/messages.json",
    "_locales/ja/messages.json",
]


def main():
    if os.path.exists(OUT):
        os.remove(OUT)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for rel in FILES:
            archive.write(os.path.join(ROOT, rel.replace("/", os.sep)), rel)
    print(OUT)


if __name__ == "__main__":
    main()
