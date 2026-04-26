export function formatUsdFull(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatUsdAbbrev(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  let body: string;
  if (dollars >= 1_000_000_000) body = `$${(dollars / 1_000_000_000).toFixed(2)}B`;
  else if (dollars >= 1_000_000) body = `$${(dollars / 1_000_000).toFixed(2)}M`;
  else if (dollars >= 10_000) body = `$${(dollars / 1_000).toFixed(0)}K`;
  else body = formatUsdFull(abs);
  return negative ? `−${body}` : body;
}

export function formatCellOrDash(cents: number): string {
  return cents === 0 ? "—" : formatUsdFull(cents);
}
