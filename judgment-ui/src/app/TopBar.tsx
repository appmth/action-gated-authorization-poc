'use client';

import { useState, useEffect, useRef } from 'react';
import { useSidebar } from './SidebarContext';

export function TopBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toggle } = useSidebar();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className="bg-gray-900 text-white h-12 flex items-center px-4 justify-between">
      {/* Brand Block - Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="lg:hidden p-1 rounded hover:bg-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
        <img src="/judgment-ui-favicon.svg" alt="Judgment" width={32} height={32} />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm">Judgment</span>
          <span className="text-xs text-gray-400 hidden sm:block">AI Governance Platform</span>
        </div>
      </div>

      {/* Right: Project label + User icon */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-300 hidden md:block">Project: Government AI Oversight</span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300 hover:bg-gray-500 transition-colors"
          >
            U
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white text-gray-900 shadow-lg rounded-lg p-4 z-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-sm text-gray-300">
                  U
                </div>
                <div>
                  <div className="font-semibold text-sm">admin user</div>
                  <div className="text-xs text-gray-600">admin@example.com</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
