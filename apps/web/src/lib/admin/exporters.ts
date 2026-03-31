"use client";

export interface CsvColumn<TItem> {
  header: string;
  value: (item: TItem) => boolean | number | string | null | undefined;
}

export interface CsvExportConfig<TItem> {
  columns: CsvColumn<TItem>[];
  filename: string;
  rows: TItem[];
}

function escapeCsvValue(value: boolean | number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).replace(/\r\n/g, "\n");

  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

export function downloadCsv<TItem>(config: CsvExportConfig<TItem>): void {
  const lines = [
    config.columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...config.rows.map((row) =>
      config.columns.map((column) => escapeCsvValue(column.value(row))).join(",")
    )
  ];

  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = config.filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
