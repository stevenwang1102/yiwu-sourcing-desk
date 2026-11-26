export interface ParsedKeyword {
  keyword: string;
  monthlySearches: number | null;
  competition: string | null;
  bidLow: number | null;
  bidHigh: number | null;
  bidCurrency: string | null;
  trendIndex: number | null;
}

export interface ParsedSerp {
  keyword: string;
  position: number;
  title: string;
  url: string;
  type: string;
}

function normHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[：:]/g, "");
}

const KW_HEADERS = new Set(["keyword", "keywords", "关键字", "关键词", "字词"]);
const SV_HEADERS = new Set([
  "avg. monthly searches",
  "avg monthly searches",
  "average monthly searches",
  "月均搜索量",
  "平均每月搜索量",
  "月均搜索次数",
]);
const COMP_HEADERS = new Set(["competition", "竞争程度", "竞争"]);
const LOW_HEADERS = new Set([
  "top of page bid (low range)",
  "top of page bid low range",
  "页首出价（低价位）",
  "页首出价(低价位)",
  "页首出价低价位",
]);
const HIGH_HEADERS = new Set([
  "top of page bid (high range)",
  "top of page bid high range",
  "页首出价（高价位）",
  "页首出价(高价位)",
  "页首出价高价位",
]);
const TREND_HEADERS = new Set(["interest", "趋势指数", "热度", "google trends", "相对热度"]);
const POS_HEADERS = new Set(["position", "rank", "排名", "位置"]);
const TITLE_HEADERS = new Set(["title", "标题", "页面标题"]);
const URL_HEADERS = new Set(["url", "链接", "网址"]);
const TYPE_HEADERS = new Set(["type", "类型", "页面类型"]);

function parseNumber(raw: string): { value: number | null; currency: string | null } {
  const text = raw.trim();
  if (!text || text === "—" || text === "-" || text === "–" || text.toLowerCase() === "n/a" || text === "未知") {
    return { value: null, currency: null };
  }
  let currency: string | null = null;
  if (text.includes("¥") || text.includes("￥") || text.toUpperCase().includes("CNY")) currency = "CNY";
  if (text.includes("$") || text.toUpperCase().includes("USD")) currency = "USD";
  const cleaned = text.replace(/[¥￥$,]/g, "").replace(/usd|cny/gi, "").trim();
  if (!cleaned || Number.isNaN(Number(cleaned))) return { value: null, currency };
  return { value: Number(cleaned), currency };
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(text: string) {
  const line = text.split(/\r?\n/).find((row) => row.trim()) ?? "";
  if (line.includes("\t")) return "\t";
  if (line.includes("|") && line.split("|").length > 2) return "|";
  return ",";
}

function table(text: string) {
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => splitCsvLine(line.replace(/^\|/, "").replace(/\|$/, ""), delimiter).filter((cell, index, all) => !(delimiter === "|" && cell === "" && (index === 0 || index === all.length - 1))));
  return rows.filter((row) => row.some((cell) => cell && cell !== "---" && !/^-+$/.test(cell)));
}

function headerIndex(headers: string[], names: Set<string>) {
  return headers.findIndex((header) => names.has(normHeader(header)));
}

export function parseKeywordPaste(text: string, source: "Keyword Planner" | "Google Trends") {
  const warnings: string[] = [];
  const rows = table(text);
  if (rows.length < 2) {
    return { rows: [] as ParsedKeyword[], warnings: ["至少需要表头和一行数据。"] };
  }
  const headers = rows[0].map(normHeader);
  const keywordAt = headerIndex(rows[0], KW_HEADERS);
  if (keywordAt < 0) {
    warnings.push("没有识别到「关键字 / Keyword」列。已尝试把第一列当关键字。");
  }
  const kwCol = keywordAt >= 0 ? keywordAt : 0;
  const svCol = headerIndex(rows[0], SV_HEADERS);
  const compCol = headerIndex(rows[0], COMP_HEADERS);
  const lowCol = headerIndex(rows[0], LOW_HEADERS);
  const highCol = headerIndex(rows[0], HIGH_HEADERS);
  const trendCol = headerIndex(rows[0], TREND_HEADERS);
  if (source === "Keyword Planner" && svCol < 0) {
    warnings.push("没有识别到月均搜索量列。搜索量会记为未知，不会用 0 填充。");
  }
  if (source === "Google Trends" && trendCol < 0 && svCol < 0) {
    warnings.push("没有识别到热度列。Trends 数字不会被写成搜索量。");
  }
  const parsed: ParsedKeyword[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((cell) => /^-+$/.test(cell))) continue;
    const keyword = row[kwCol]?.trim();
    if (!keyword || KW_HEADERS.has(normHeader(keyword))) continue;
    const sv = svCol >= 0 ? parseNumber(row[svCol] ?? "") : { value: null, currency: null };
    const low = lowCol >= 0 ? parseNumber(row[lowCol] ?? "") : { value: null, currency: null };
    const high = highCol >= 0 ? parseNumber(row[highCol] ?? "") : { value: null, currency: null };
    const trend = trendCol >= 0 ? parseNumber(row[trendCol] ?? "") : { value: null, currency: null };
    parsed.push({
      keyword,
      monthlySearches: source === "Google Trends" ? null : sv.value,
      competition: compCol >= 0 ? row[compCol]?.trim() || null : null,
      bidLow: low.value,
      bidHigh: high.value,
      bidCurrency: low.currency || high.currency || sv.currency,
      trendIndex: source === "Google Trends" ? trend.value ?? sv.value : trend.value,
    });
  }
  if (!parsed.length) warnings.push("没有解析出有效关键字行。");
  if (source === "Google Trends") {
    warnings.push("已按 Google Trends 处理：热度记为相对指数，月搜索量保持为空，不会把指数当成次数。");
  }
  return { rows: parsed, warnings, headers };
}

export function parseSerpPaste(text: string, fallbackKeyword: string) {
  const warnings: string[] = [];
  const rows = table(text);
  if (!rows.length) return { rows: [] as ParsedSerp[], warnings: ["没有读到表格行。"] };
  const posCol = headerIndex(rows[0], POS_HEADERS);
  const titleCol = headerIndex(rows[0], TITLE_HEADERS);
  const urlCol = headerIndex(rows[0], URL_HEADERS);
  const typeCol = headerIndex(rows[0], TYPE_HEADERS);
  const kwCol = headerIndex(rows[0], KW_HEADERS);
  const hasHeader = posCol >= 0 || titleCol >= 0 || urlCol >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) warnings.push("没有识别到表头。已按「排名、标题、链接、类型」的顺序读取。");
  if (!fallbackKeyword && kwCol < 0) warnings.push("缺少关键词。请在输入框填写这批评词所属的检索词。");
  const parsed: ParsedSerp[] = [];
  body.forEach((row, index) => {
    const positionRaw = posCol >= 0 ? row[posCol] : row[0];
    const position = Number(String(positionRaw).replace(/[^\d]/g, "")) || index + 1;
    const title = (titleCol >= 0 ? row[titleCol] : row[1])?.trim();
    if (!title) return;
    parsed.push({
      keyword: (kwCol >= 0 ? row[kwCol] : fallbackKeyword).trim() || fallbackKeyword,
      position,
      title,
      url: (urlCol >= 0 ? row[urlCol] : row[2])?.trim() || "",
      type: (typeCol >= 0 ? row[typeCol] : row[3])?.trim() || "未分类",
    });
  });
  if (!parsed.length) warnings.push("没有解析出 SERP 行。");
  warnings.push("这是你粘贴的当次观察，不会自动补满十条，也不会把缺失广告解释成对方不投流。");
  return { rows: parsed, warnings };
}

export function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
