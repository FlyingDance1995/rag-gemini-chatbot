"use client";

import { createContext, useContext, useRef, useCallback } from "react";

interface SidebarContextValue {
  /** ChatSidebar gọi hàm này để đăng ký openFn của mình */
  registerOpen: (fn: () => void) => void;
  /** ChatWindow/MobileHeader gọi để mở sidebar */
  openSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  registerOpen: () => {},
  openSidebar: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const openFnRef = useRef<(() => void) | null>(null);

  const registerOpen = useCallback((fn: () => void) => {
    openFnRef.current = fn;
  }, []);

  const openSidebar = useCallback(() => {
    openFnRef.current?.();
  }, []);

  return (
    <SidebarContext.Provider value={{ registerOpen, openSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
