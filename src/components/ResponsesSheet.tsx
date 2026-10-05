import { fetchSheet } from "@/lib/sheets";
import { Empty } from "@/components/ui";

/** Live, read-only spreadsheet view of a linked Google Sheet (e.g. Google Form responses). */
export async function ResponsesSheet({ url }: { url: string }) {
  const sheet = await fetchSheet(url);
  if (!sheet.ok) return <Empty>{sheet.error}</Empty>;
  const { header, rows } = sheet;
  if (rows.length === 0) return <Empty>No responses in the sheet yet.</Empty>;
  return (
    <div className="card max-h-[70vh] overflow-auto !p-0">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line">
            <th className="th w-10">#</th>
            {header.map((h, i) => <th key={i} className="th whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td className="td text-muted tabular-nums">{ri + 1}</td>
              {header.map((_, ci) => <td key={ci} className="td max-w-xs truncate" title={r[ci]}>{r[ci]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
