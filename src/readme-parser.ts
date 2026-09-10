export const REQUIRED_CATEGORIES = [
  "Market Data",
  "Exchange & Trading",
  "Wallets & Portfolio",
  "DeFi & NFT",
  "Payments",
  "Infrastructure",
  "News & Analytics",
] as const;

export type CatalogCategoryName = (typeof REQUIRED_CATEGORIES)[number];

export type ReadmeRow = {
  apiName: string;
  columns: string[];
};

export type CatalogCategory = {
  name: string;
  rows: ReadmeRow[];
  malformedRows: string[];
};

export type ParsedReadme = {
  title: string;
  sections: Set<string>;
  catalog: {
    categories: CatalogCategory[];
  };
};

const SECTION_HEADING_PATTERN = /^## (.+)$/gm;
const CATEGORY_HEADING_PATTERN = /^### (.+)$/gm;
const DELIMITER_CELL_PATTERN = /^:?-+:?$/;

const TABLE_HEADERS = ["API", "What It Is Good For", "Free Plan", "Auth", "Docs"] as const;

function extractSectionContent(readme: string, startHeading: string, endHeading: string): string {
  const startToken = `## ${startHeading}`;
  const endToken = `## ${endHeading}`;
  const startIndex = readme.indexOf(startToken);

  if (startIndex === -1) {
    return "";
  }

  const afterStart = readme.slice(startIndex + startToken.length);
  const endIndex = afterStart.indexOf(endToken);

  return endIndex === -1 ? afterStart : afterStart.slice(0, endIndex);
}

function extractSections(readme: string): Set<string> {
  const sections = new Set<string>();

  for (const match of readme.matchAll(SECTION_HEADING_PATTERN)) {
    sections.add(match[1]!.trim());
  }

  return sections;
}

function splitCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function isDelimiterRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL_PATTERN.test(cell));
}

function isHeaderRow(cells: string[]): boolean {
  return (
    cells.length === TABLE_HEADERS.length &&
    cells.every((cell, index) => cell.toLowerCase() === TABLE_HEADERS[index]!.toLowerCase())
  );
}

function parseRow(columns: string[]): ReadmeRow | null {
  if (columns.length !== TABLE_HEADERS.length) {
    return null;
  }

  const apiNameMatch = columns[0]?.match(/\[([^\]]+)\]\([^)]+\)/);
  const apiName = apiNameMatch?.[1]?.trim() ?? columns[0] ?? "";

  return {
    apiName,
    columns,
  };
}

function parseCategoryRows(block: string): Pick<CatalogCategory, "rows" | "malformedRows"> {
  const rows: ReadmeRow[] = [];
  const malformedRows: string[] = [];

  for (const line of block.split("\n").map((candidate) => candidate.trim())) {
    if (!line.startsWith("|")) {
      continue;
    }

    const cells = splitCells(line);

    if (isDelimiterRow(cells) || isHeaderRow(cells)) {
      continue;
    }

    const row = parseRow(cells);

    if (row) {
      rows.push(row);
    } else {
      malformedRows.push(line);
    }
  }

  return { rows, malformedRows };
}

function parseCategories(section: string): CatalogCategory[] {
  const matches = [...section.matchAll(CATEGORY_HEADING_PATTERN)];
  const categories: CatalogCategory[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const startIndex = match.index ?? 0;
    const endIndex = nextMatch?.index ?? section.length;
    const block = section.slice(startIndex, endIndex);

    categories.push({
      name: match[1]!.trim(),
      ...parseCategoryRows(block),
    });
  }

  return categories;
}

export function parseReadme(readme: string): ParsedReadme {
  const titleMatch = readme.match(/^# (.+)$/m);

  return {
    title: titleMatch?.[1]?.trim() ?? "",
    sections: extractSections(readme),
    catalog: {
      categories: parseCategories(extractSectionContent(readme, "API Categories", "Methodology")),
    },
  };
}
