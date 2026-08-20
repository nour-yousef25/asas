"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Breadcrumb } from "./breadcrumb";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 lg:px-6 no-print">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-muted"
          aria-label="فتح القائمة"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-2">
        {/* البحث */}
        <button className="hidden md:flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground hover:bg-muted" aria-label="بحث">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>بحث...</span>
        </button>

        {/* الإشعارات */}
        <button className="relative p-2 rounded-md hover:bg-muted" aria-label="الإشعارات">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.674C19.41 14.046 18 12.61 18 8A6 6 0 0 0 6 8c0 4.61-1.41 6.046-2.738 7.326z" />
          </svg>
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
        </button>

        {/* قائمة المستخدم */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              م
            </div>
            <span className="hidden md:block text-sm font-medium">المدير</span>
            <svg className={`transition-transform ${menuOpen && "rotate-180"}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 mt-2 w-56 rounded-md border bg-popover p-1 shadow-md z-20">
                <Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                  الإعدادات
                </Link>
                <Link href="/organization" className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                  بيانات الجمعية
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-danger"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  تسجيل الخروج
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
