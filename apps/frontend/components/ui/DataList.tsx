import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Oculta la columna en la tarjeta de celular (datos secundarios). */
  hideOnMobile?: boolean;
}

/**
 * Listado responsive: tabla desde md; en celulares, una tarjeta por fila con
 * "etiqueta: valor" (sin scroll horizontal).
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  empty = 'Sin resultados.',
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">{empty}</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 text-sm text-gray-700 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <dl className="space-y-1">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="flex justify-between gap-4 text-sm">
                    <dt className="text-gray-400">{c.header}</dt>
                    <dd className="text-right text-gray-800">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
