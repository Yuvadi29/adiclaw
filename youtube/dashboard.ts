import chalk from "chalk";
import type { YouTubeAnalyticsSummary } from "./analytics";
import type { YouTubeChannelSummary } from "./channel";

// ==========================================
// Formatting & Number Utilities
// ==========================================

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

function truncateVisible(str: string, maxLen: number): string {
  if (visibleLength(str) <= maxLen) return str;
  // Fallback safe slice
  return str.slice(0, maxLen - 1) + "…";
}

function padVisible(
  str: string,
  targetLength: number,
  align: "left" | "right" | "center" = "left",
): string {
  const visible = visibleLength(str);
  if (visible >= targetLength) return str;
  const diff = targetLength - visible;

  if (align === "left") {
    return str + " ".repeat(diff);
  }
  if (align === "right") {
    return " ".repeat(diff) + str;
  }
  const leftPad = Math.floor(diff / 2);
  const rightPad = diff - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return value.toString();
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + (currentLine ? " " : "") + word).length <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatWatchTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0 hrs";
  }

  const hours = minutes / 60;
  if (hours >= 1_000_000) {
    return `${formatCompactNumber(hours)} hrs`;
  }
  if (hours >= 1000) {
    return `${formatNumber(hours)} hrs`;
  }
  return `${hours.toFixed(1)} hrs`;
}

function createProgressBar(
  percentage: number,
  width: number,
  filledColor: (str: string) => string,
  emptyColor: (str: string) => string = chalk.hex("#27272A"),
): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledChars = Math.round((clamped / 100) * width);
  const emptyChars = Math.max(0, width - filledChars);

  const filledBar = "█".repeat(filledChars);
  const emptyBar = "░".repeat(emptyChars);

  return filledColor(filledBar) + emptyColor(emptyBar);
}

function formatCardNumber(value: number): string {
  const formatted = formatNumber(value);
  if (formatted.length <= 13) {
    return formatted;
  }
  return formatCompactNumber(value);
}

// ==========================================
// Theme & Color Palette
// ==========================================

const THEME = {
  // Brand colors
  ytRed: chalk.hex("#FF0000"),
  ytRedGlow: chalk.hex("#FF2A42").bold,
  ytBadge: chalk.bgHex("#CC0000").white.bold,

  // Borders & Structure
  borderOuter: chalk.hex("#475569"),
  borderMuted: chalk.hex("#334155"),
  borderCyan: chalk.hex("#0E7490"),
  borderAmber: chalk.hex("#B45309"),
  borderPurple: chalk.hex("#6D28D9"),
  borderGreen: chalk.hex("#047857"),

  // Text & Accents
  title: chalk.hex("#FFFFFF").bold,
  subTitle: chalk.hex("#94A3B8"),
  label: chalk.hex("#64748B"),
  value: chalk.hex("#F8FAFC").bold,
  dim: chalk.hex("#475569"),

  // Neon Metrics
  green: chalk.hex("#10B981"),
  greenBright: chalk.hex("#34D399").bold,
  cyan: chalk.hex("#06B6D4"),
  cyanBright: chalk.hex("#38BDF8").bold,
  indigo: chalk.hex("#818CF8"),
  purple: chalk.hex("#A855F7"),
  purpleBright: chalk.hex("#C084FC").bold,
  amber: chalk.hex("#F59E0B"),
  amberBright: chalk.hex("#FBBF24").bold,
  rose: chalk.hex("#F43F5E"),
  roseBright: chalk.hex("#FB7185").bold,
  white: chalk.hex("#FFFFFF"),
};

interface BoxCardOptions {
  title: string;
  badge?: string;
  width: number;
  lines: string[];
  borderColor?: (s: string) => string;
  titleColor?: (s: string) => string;
}

function renderCard(options: BoxCardOptions): string[] {
  const {
    title,
    badge,
    width,
    lines,
    borderColor = THEME.borderMuted,
    titleColor = THEME.title,
  } = options;

  const innerWidth = width - 2;
  const badgePart = badge ? ` ${badge}` : "";
  const headerContent = titleColor(` ${title}${badgePart} `);
  const headerLen = visibleLength(headerContent);

  const leftBarLen = 1; // single '─' after '╭'
  const rightBarLen = Math.max(0, innerWidth - leftBarLen - headerLen);

  const topBorder =
    borderColor("╭" + "─".repeat(leftBarLen)) +
    headerContent +
    borderColor("─".repeat(rightBarLen) + "╮");

  const contentRows = lines.map((line) => {
    const padded = padVisible(line, innerWidth);
    return borderColor("│") + padded + borderColor("│");
  });

  const bottomBorder = borderColor("╰" + "─".repeat(innerWidth) + "╯");

  return [topBorder, ...contentRows, bottomBorder];
}

function combineSideBySide(
  leftLines: string[],
  rightLines: string[],
  gap = 2,
): string[] {
  const maxRows = Math.max(leftLines.length, rightLines.length);
  const leftWidth = leftLines.length > 0 ? visibleLength(leftLines[0]) : 0;
  const rightWidth = rightLines.length > 0 ? visibleLength(rightLines[0]) : 0;

  const result: string[] = [];
  const spacer = " ".repeat(gap);

  for (let i = 0; i < maxRows; i++) {
    const left = leftLines[i] ?? " ".repeat(leftWidth);
    const right = rightLines[i] ?? " ".repeat(rightWidth);
    result.push(left + spacer + right);
  }

  return result;
}

// ==========================================
// Dashboard Renderer
// ==========================================

export function renderYouTubeDashboard(
  channel: YouTubeChannelSummary,
  analytics: YouTubeAnalyticsSummary,
): void {
  const TOTAL_WIDTH = 86;
  const INNER_WIDTH = TOTAL_WIDTH - 2; // 84

  // Derived Analytics Calculations
  const netSubs = analytics.subscribersGained - analytics.subscribersLost;
  const previousSubs = Math.max(1, channel.subscribers - netSubs);
  const subGrowthPct = (netSubs / previousSubs) * 100;

  const subRetentionRate =
    analytics.subscribersGained > 0
      ? (Math.max(0, netSubs) / analytics.subscribersGained) * 100
      : 100;

  const dailyAvgViews = Math.round(analytics.views / 28);
  const dailyAvgWatchHours = analytics.estimatedMinutesWatched / 28 / 60;
  const viewsPerVideo =
    channel.videos > 0 ? Math.round(channel.views / channel.videos) : 0;

  const likeRate =
    analytics.views > 0 ? (analytics.likes / analytics.views) * 100 : 0;
  const commentRate =
    analytics.views > 0 ? (analytics.comments / analytics.views) * 100 : 0;
  const totalEngagements = analytics.likes + analytics.comments;
  const engagementRate =
    analytics.views > 0 ? (totalEngagements / analytics.views) * 100 : 0;
  const likeToCommentRatio =
    analytics.comments > 0
      ? (analytics.likes / analytics.comments).toFixed(1)
      : "0.0";
  const subConversionRate =
    analytics.views > 0
      ? (analytics.subscribersGained / analytics.views) * 100
      : 0;

  // Print Empty Line
  console.log();

  // 1. Sleek Outer Frame Top Header
  const headerTitle = `┏━━ ${THEME.ytBadge(" ▶ YouTube Studio ")} ━ ${chalk.bgHex("#1E293B").hex("#CBD5E1").bold(" PRO ANALYTICS ")} `;
  const headerRightBadge = ` ${THEME.greenBright("● LIVE SYNC")} ━━┓`;
  const headerBarFill = Math.max(
    0,
    TOTAL_WIDTH - visibleLength(headerTitle) - visibleLength(headerRightBadge),
  );
  console.log(
    THEME.borderOuter(headerTitle) +
      THEME.borderOuter("━".repeat(headerBarFill)) +
      THEME.borderOuter(headerRightBadge),
  );

  // Channel Title & Verified Badge
  const channelTitle = THEME.white.bold(channel.title);
  const verifiedBadge = chalk.hex("#38BDF8")("✔ Verified Partner");
  const channelInfoLeft = `  ${channelTitle}  ${verifiedBadge}`;
  const dateLabel = `${THEME.amber("📅 28-Day Window:")} ${THEME.subTitle(`${analytics.startDate} → ${analytics.endDate}`)}`;
  const row1Gap = Math.max(
    1,
    INNER_WIDTH - visibleLength(channelInfoLeft) - visibleLength(dateLabel) - 2,
  );
  console.log(
    THEME.borderOuter("┃") +
      channelInfoLeft +
      " ".repeat(row1Gap) +
      dateLabel +
      "  " +
      THEME.borderOuter("┃"),
  );

  // Channel ID & Videos
  const idLabel = `  ${THEME.label("Channel ID:")} ${THEME.dim(channel.id)}`;
  const videosLabel = `${THEME.label("Catalog:")} ${THEME.value(`${formatNumber(channel.videos)} videos published`)}`;
  const row2Gap = Math.max(
    1,
    INNER_WIDTH - visibleLength(idLabel) - visibleLength(videosLabel) - 2,
  );
  console.log(
    THEME.borderOuter("┃") +
      idLabel +
      " ".repeat(row2Gap) +
      videosLabel +
      "  " +
      THEME.borderOuter("┃"),
  );

  console.log(THEME.borderOuter("┣" + "━".repeat(INNER_WIDTH) + "┫"));

  // 2. Hero KPI Cards (4 Cards across 84 chars width: 4 * 19 + 3 * 2 = 82, perfectly centered with 1 space each side)
  const KPI_INNER_WIDTH = 17; // Total box width = 19
  const renderKpiTile = (
    label: string,
    mainVal: string,
    subVal: string,
    borderColor: (s: string) => string,
  ) => {
    return [
      borderColor("┌" + "─".repeat(KPI_INNER_WIDTH) + "┐"),
      borderColor("│") +
        padVisible(label, KPI_INNER_WIDTH, "center") +
        borderColor("│"),
      borderColor("│") +
        padVisible(mainVal, KPI_INNER_WIDTH, "center") +
        borderColor("│"),
      borderColor("│") +
        padVisible(subVal, KPI_INNER_WIDTH, "center") +
        borderColor("│"),
      borderColor("└" + "─".repeat(KPI_INNER_WIDTH) + "┘"),
    ];
  };

  const kpiSubDelta =
    netSubs >= 0
      ? THEME.greenBright(
          `▲ +${formatCompactNumber(netSubs)} (${subGrowthPct.toFixed(1)}%)`,
        )
      : THEME.roseBright(`▼ -${formatCompactNumber(Math.abs(netSubs))}`);

  const kpi1 = renderKpiTile(
    THEME.label("SUBSCRIBERS"),
    THEME.white.bold(formatCompactNumber(channel.subscribers)),
    kpiSubDelta,
    THEME.borderCyan,
  );

  const kpi2 = renderKpiTile(
    THEME.label("28D VIEWS"),
    THEME.cyanBright(formatCompactNumber(analytics.views)),
    THEME.subTitle(`~${formatCompactNumber(dailyAvgViews)} / d`),
    THEME.borderCyan,
  );

  const kpi3 = renderKpiTile(
    THEME.label("WATCH TIME"),
    THEME.purpleBright(formatWatchTime(analytics.estimatedMinutesWatched)),
    THEME.subTitle(`~${formatCompactNumber(dailyAvgWatchHours)}h / d`),
    THEME.borderPurple,
  );

  const kpi4 = renderKpiTile(
    THEME.label("ENGAGEMENT"),
    THEME.amberBright(`${engagementRate.toFixed(2)}%`),
    THEME.subTitle(`${formatCompactNumber(totalEngagements)} total`),
    THEME.borderAmber,
  );

  const row1Cards = combineSideBySide(
    combineSideBySide(kpi1, kpi2, 2),
    combineSideBySide(kpi3, kpi4, 2),
    2,
  );

  for (const row of row1Cards) {
    console.log(
      THEME.borderOuter("┃") +
        padVisible(row, INNER_WIDTH, "center") +
        THEME.borderOuter("┃"),
    );
  }

  console.log(THEME.borderOuter("┣" + "━".repeat(INNER_WIDTH) + "┫"));

  // 3. Middle Section: Two Columns (Channel Lifetime vs 28-Day Velocity)
  // Card width = 40. 40 + 2 (gap) + 40 = 82. Centered in 84.
  const COL_WIDTH = 40;

  const subGrowthStr = `${netSubs >= 0 ? "+" : ""}${formatCompactNumber(netSubs)} (${subGrowthPct >= 0 ? "+" : ""}${subGrowthPct.toFixed(1)}%)`;

  const card1Lines = [
    `  ${THEME.label("Total Subscribers")}   ${THEME.value(formatCardNumber(channel.subscribers).padStart(15))}`,
    `  ${THEME.label("Lifetime Views")}      ${THEME.value(formatCardNumber(channel.views).padStart(15))}`,
    `  ${THEME.label("Total Uploads")}       ${THEME.value(formatNumber(channel.videos).padStart(15))}`,
    `  ${THEME.label("Avg Views / Video")}   ${THEME.cyanBright(formatCardNumber(viewsPerVideo).padStart(15))}`,
    `  ${THEME.dim("─".repeat(COL_WIDTH - 6))}`,
    `  ${THEME.label("Sub Growth (28d)")}    ${netSubs >= 0 ? THEME.greenBright(subGrowthStr.padStart(15)) : THEME.roseBright(subGrowthStr.padStart(15))}`,
    `  ${THEME.label("Gained / Lost")}       ${THEME.green(`+${formatCompactNumber(analytics.subscribersGained)}`)} ${THEME.dim("/")} ${THEME.rose(`-${formatCompactNumber(analytics.subscribersLost)}`)}`,
  ];

  const card2Lines = [
    `  ${THEME.label("Period Views")}        ${THEME.cyanBright(formatCardNumber(analytics.views).padStart(15))}`,
    `  ${THEME.label("Daily Velocity")}      ${THEME.cyan(`${formatCardNumber(dailyAvgViews)} views/d`.padStart(15))}`,
    `  ${THEME.label("Avg View Duration")}   ${THEME.purpleBright(formatDuration(analytics.averageViewDuration).padStart(15))}`,
    `  ${THEME.label("Total Watch Time")}    ${THEME.purple(formatWatchTime(analytics.estimatedMinutesWatched).padStart(15))}`,
    `  ${THEME.dim("─".repeat(COL_WIDTH - 6))}`,
    `  ${THEME.label("Total Likes")}         ${THEME.amberBright(formatCardNumber(analytics.likes).padStart(15))}`,
    `  ${THEME.label("Total Comments")}      ${THEME.amber(formatCardNumber(analytics.comments).padStart(15))}`,
  ];

  const cardLeft = renderCard({
    title: "CHANNEL OVERVIEW",
    badge: THEME.dim("[LIFETIME]"),
    width: COL_WIDTH,
    lines: card1Lines,
    borderColor: THEME.borderMuted,
    titleColor: THEME.title,
  });

  const cardRight = renderCard({
    title: "VELOCITY & METRICS",
    badge: THEME.amber("[28 DAYS]"),
    width: COL_WIDTH,
    lines: card2Lines,
    borderColor: THEME.borderMuted,
    titleColor: THEME.title,
  });

  const middleCardsCombined = combineSideBySide(cardLeft, cardRight, 2);
  for (const line of middleCardsCombined) {
    console.log(
      THEME.borderOuter("┃") +
        padVisible(line, INNER_WIDTH, "center") +
        THEME.borderOuter("┃"),
    );
  }

  console.log(THEME.borderOuter("┣" + "━".repeat(INNER_WIDTH) + "┫"));

  // 4. Visual Gauges & Retention Analysis
  const BAR_WIDTH = 34;

  const gauge1Lines = [
    `  ${THEME.value("Sub Retention")}  ${THEME.greenBright(`${subRetentionRate.toFixed(1)}%`)} ${THEME.dim(`(+${formatCompactNumber(analytics.subscribersGained)}/-${formatCompactNumber(analytics.subscribersLost)})`)}`,
    `  ${createProgressBar(subRetentionRate, BAR_WIDTH, THEME.greenBright)}`,
    `  ${THEME.dim("─".repeat(COL_WIDTH - 6))}`,
    `  ${THEME.value("Sub Conversion")} ${THEME.cyanBright(`${subConversionRate.toFixed(2)}%`)} ${THEME.dim("(Views➔Subs)")}`,
    `  ${createProgressBar(Math.min(100, subConversionRate * 25), BAR_WIDTH, THEME.cyanBright)}`,
  ];

  const gauge2Lines = [
    `  ${THEME.value("Like Ratio")}     ${THEME.amberBright(`${likeRate.toFixed(2)}%`)} ${THEME.dim(`(${formatCompactNumber(analytics.likes)} likes)`)}`,
    `  ${createProgressBar(Math.min(100, likeRate * 10), BAR_WIDTH, THEME.amberBright)}`,
    `  ${THEME.dim("─".repeat(COL_WIDTH - 6))}`,
    `  ${THEME.value("Engagement")}     ${THEME.purpleBright(`${engagementRate.toFixed(2)}%`)} ${THEME.dim(`(${likeToCommentRatio}:1 L/C)`)}`,
    `  ${createProgressBar(Math.min(100, engagementRate * 8), BAR_WIDTH, THEME.purpleBright)}`,
  ];

  const gaugeCardLeft = renderCard({
    title: "AUDIENCE RETENTION & CONVERSION",
    width: COL_WIDTH,
    lines: gauge1Lines,
    borderColor: THEME.borderMuted,
    titleColor: THEME.title,
  });

  const gaugeCardRight = renderCard({
    title: "ENGAGEMENT & COMMUNITY RATIOS",
    width: COL_WIDTH,
    lines: gauge2Lines,
    borderColor: THEME.borderMuted,
    titleColor: THEME.title,
  });

  const gaugesCombined = combineSideBySide(gaugeCardLeft, gaugeCardRight, 2);
  for (const line of gaugesCombined) {
    console.log(
      THEME.borderOuter("┃") +
        padVisible(line, INNER_WIDTH, "center") +
        THEME.borderOuter("┃"),
    );
  }

  console.log(THEME.borderOuter("┣" + "━".repeat(INNER_WIDTH) + "┫"));

  // 5. Intelligent AI Insight / Health Verdict
  let healthVerdict = "🚀 High Growth Momentum";
  let healthTip =
    "Audience retention and engagement rates are performing above YouTube platform averages.";

  if (subRetentionRate < 70) {
    healthVerdict = "⚠️ Subscriber Churn Detected";
    healthTip =
      "Subscribers lost are elevated. Review recent video audience drop-off points.";
  } else if (engagementRate > 6) {
    healthVerdict = "🔥 Viral Interaction Momentum";
    healthTip = `Exceptional ${engagementRate.toFixed(1)}% interaction rate demonstrates strong viewer loyalty.`;
  }

  const insightHeader = `  ${THEME.amber("⚡ PERFORMANCE INSIGHT:")} ${THEME.white.bold(healthVerdict)}`;
  console.log(
    THEME.borderOuter("┃") +
      padVisible(insightHeader, INNER_WIDTH) +
      THEME.borderOuter("┃"),
  );

  const wrappedTips = wrapText(healthTip, INNER_WIDTH - 8);
  wrappedTips.forEach((tipLine, index) => {
    const formattedTip =
      index === 0
        ? `  ${THEME.dim("→")} ${THEME.subTitle(tipLine)}`
        : `    ${THEME.subTitle(tipLine)}`;
    console.log(
      THEME.borderOuter("┃") +
        padVisible(formattedTip, INNER_WIDTH) +
        THEME.borderOuter("┃"),
    );
  });

  console.log(THEME.borderOuter("┣" + "━".repeat(INNER_WIDTH) + "┫"));

  // 6. Footer Info
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toISOString().slice(0, 10);
  const footerLeft = `  ${THEME.dim("AdiClaw YouTube Analytics Studio v2.4")}`;
  const footerRight = `${THEME.dim("Last Synced:")} ${THEME.subTitle(`${dateStr} ${timeStr}`)}  `;
  const footerGap = Math.max(
    1,
    INNER_WIDTH - visibleLength(footerLeft) - visibleLength(footerRight),
  );

  console.log(
    THEME.borderOuter("┃") +
      footerLeft +
      " ".repeat(footerGap) +
      footerRight +
      THEME.borderOuter("┃"),
  );
  console.log(THEME.borderOuter("┗" + "━".repeat(INNER_WIDTH) + "┛"));
  console.log();
}
