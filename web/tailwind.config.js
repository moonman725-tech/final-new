/** @type {import('tailwindcss').Config} */
export default { content:['./index.html','./src/**/*.{js,jsx,ts,tsx}'], theme:{ extend:{} }, plugins:[] }
// src/components/StockTable.jsx
import React from "react";

function money(n) {
  if (n == null || Number.isNaN(n)) return "£0.00";
  return `£${Number(n).toFixed(2)}`;
}

/**
 * items: Array of
 * { id, name, category, supplier, qty, unitPrice }
 * onEdit?: (id) => void
 */
export default function StockTable({ items = [], onEdit = () => {} }) {
  const grandTotal = items.reduce(
    (sum, r) => sum + Number(r.qty || 0) * Number(r.unitPrice || 0),
    0
  );

  return (
    <div className="overflow-x-auto">
      {/* min width stops column squashing on mobiles; table-fixed prevents overlap */}
      <table className="min-w-[720px] w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-slate-700">
            <th className="px-3 py-2 text-left w-[34%]">Item</th>
            <th className="px-3 py-2 text-left w-[18%]">Category</th>
            <th className="px-3 py-2 text-left w-[16%]">Supplier</th>
            <th className="px-3 py-2 text-right w-[10%]">Quantity</th>
            <th className="px-3 py-2 text-right w-[12%]">Unit&nbsp;Price</th>
            <th className="px-3 py-2 text-right w-[12%]">Total</th>
            <th className="px-3 py-2 text-right w-[8%]"> </th>
          </tr>
        </thead>

        <tbody>
          {items.map((r) => {
            const total = Number(r.qty || 0) * Number(r.unitPrice || 0);
            return (
              <tr key={r.id} className="align-top border-t">
                {/* Text columns wrap safely */}
                <td className="px-3 py-3 break-words">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    {r.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200">
                        {r.category}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 break-words">{r.category}</td>
                <td className="px-3 py-3 break-words">{r.supplier}</td>

                {/* Numeric columns never wrap */}
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {r.qty ?? 0}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {money(r.unitPrice)}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {money(total)}
                </td>

                {/* Actions don’t compress others */}
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(r.id)}
                    className="border px-3 py-1 rounded-md"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t">
            <td className="px-3 py-3 font-semibold" colSpan={5}>
              Total
            </td>
            <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
              {money(grandTotal)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
