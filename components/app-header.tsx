"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Home, Menu, X, Droplets } from "lucide-react";
import { useState } from "react";

interface AppHeaderProps {
  title?: string;
  githubUrl?: string;
}

export function AppHeader({
  title = "EPANET Utilities",
  githubUrl = "https://github.com/modelcreate/epanet-utilities",
}: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center">
            {!isHomePage && (
              <Link
                href="/"
                className="mr-3 p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Back to home"
              >
                <Home className="h-4 w-4" />
              </Link>
            )}
            <Link href="/" className="flex items-center">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-1.5 rounded-md mr-2">
                <Droplets className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Github className="h-4 w-4 mr-2" />
              GitHub
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-2 absolute w-full shadow-md">
          <div className="container mx-auto px-4 space-y-1">
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Github className="h-4 w-4 mr-3" />
              GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
