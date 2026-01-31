"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-[calc(100vh-64px)] fixed top-16 left-0 overflow-y-auto">
      <div className="p-4">
        {/* Logo Area (Plan: Left Top, but technically Sidebar is below TopBar in wireframe. 
            However, usually Logo is in Sidebar or TopBar. 
            The plan says: 
            [ LOGO ]
            Judgment ...
            
            But "2. Logo Area (Left Top)" says "Click logo to return to Judgment Map".
            And "3. Top Bar" says "Product Name: Judgment".
            
            Let's put the main Logo in the Sidebar as per "1. Sidebar > Configuration > [ LOGO ]".
            The TopBar will have "Judgment > Project: gov-demo".
        */}
        <div className="mb-8">
          <Link href="/dashboard" className="block">
            <h1 className="text-xl font-bold text-gray-900">Judgment</h1>
            <p className="text-xs text-gray-500 mt-1">Action-Gated Authorization</p>
          </Link>
        </div>

        <nav className="space-y-6">
          <div>
            <h2 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Judgment
            </h2>
            <div className="space-y-1">
              <NavLink href="/dashboard" label="Map" />
              <NavLink href="/graph" label="Graph" />
            </div>
          </div>

          <div>
            <h2 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Settings
            </h2>
            <div className="space-y-1">
              <NavLink href="#" label="General" />
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  // Special handling for dashboard home logic if needed, but simple specific check is fine.
  // Actually, dashboard is the root of the app's main view, so maybe strict check or check if it's the start.
  // Let's keep it simple: exact match or starts with for sub-routes?
  // If href is /dashboard, it matches /dashboard.
  // If href is /graph, it matches /graph.

  const isSelected = pathname === href;

  return (
    <Link
      href={href}
      className={`block px-2 py-2 text-sm font-medium rounded-md ${isSelected
          ? 'bg-gray-200 text-gray-900'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      {label}
    </Link>
  );
}
