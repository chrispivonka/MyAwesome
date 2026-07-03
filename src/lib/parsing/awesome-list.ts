import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Heading, Link, List, ListItem, Paragraph, Root } from "mdast";

export interface ParsedAwesomeItem {
  title: string;
  url: string;
  description: string;
  section: string;
}

/**
 * Extracts `[title](url) - description` style entries from an awesome-list
 * README. Only looks at the first link in each top-level list item's
 * paragraph — nested sub-lists (some lists group items under sub-bullets)
 * are intentionally not recursed into to avoid pulling in unrelated links.
 */
export function parseAwesomeMarkdown(markdown: string): ParsedAwesomeItem[] {
  const tree = fromMarkdown(markdown) as Root;
  const items: ParsedAwesomeItem[] = [];
  let currentSection = "";

  for (const node of tree.children) {
    if (node.type === "heading") {
      currentSection = toString(node as Heading).trim();
      continue;
    }
    if (node.type === "list") {
      for (const listItem of (node as List).children) {
        const item = extractItem(listItem, currentSection);
        if (item) items.push(item);
      }
    }
  }

  return items;
}

function extractItem(
  listItem: ListItem,
  section: string,
): ParsedAwesomeItem | null {
  const paragraph = listItem.children.find(
    (child): child is Paragraph => child.type === "paragraph",
  );
  if (!paragraph) return null;

  let link: Link | undefined;
  visit(paragraph, "link", (node) => {
    if (!link) link = node;
  });
  if (!link) return null;

  const title = toString(link).trim();
  const url = link.url;
  // In-page anchors (`#section`) are table-of-contents navigation, not
  // actual list items — every awesome-list README has a few of these.
  if (!title || !url || url.startsWith("#")) return null;

  const fullText = toString(paragraph);
  const idx = fullText.indexOf(title);
  const description =
    idx >= 0
      ? fullText
          .slice(idx + title.length)
          .replace(/^[\s:—–-]+/, "")
          .trim()
      : "";

  return { title, url, description, section };
}
