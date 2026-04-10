/**
 * Workbench layout — main'in padding ve overflow-y-auto'sunu ezer,
 * Topbar (h-14 = 56px) dışındaki tüm alanı kaplar.
 */
export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-m-3 -mb-20 md:-m-6 md:-mb-6"
      style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {children}
    </div>
  );
}
