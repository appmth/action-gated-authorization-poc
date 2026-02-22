"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { label: "Activity Log", href: "/activity" },
  { label: "Governance Insights", href: "/governance" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* Backdrop for mobile/tablet */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={close}
        />
      )}

      <aside
        className={`
          w-60 bg-white border-r border-gray-200 flex flex-col
          fixed top-12 bottom-0 z-50
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:transition-none
        `}
      >
        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          {/* Overview section */}
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Overview
          </div>
          <ul className="space-y-1 mb-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className={`block px-3 py-2 rounded text-sm ${
                      isActive
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
