/**
 * Workbench layout — main'in p-3/p-6 padding'ini sıfırlar,
 * Topbar (h-14 = 56px) dışında kalan alanı tam doldurur.
 */
export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-m-3 -mb-20 md:-m-6 md:-mb-6 flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {children}
    </div>
  );
}
