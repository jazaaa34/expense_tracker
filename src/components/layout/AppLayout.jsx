
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileNav from './MobileNav';

export default function AppLayout({ currentTab, onSelectTab, onOpenAddTxn, onOpenScanBill, onOpenApiKeyModal, searchQuery, onSearchChange, children }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="app-container">
      <Sidebar 
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
        onOpenAddTxn={onOpenAddTxn}
      />

      <div className="main-viewport">
        <TopNav 
          currentTab={currentTab}
          onOpenAddTxn={onOpenAddTxn}
          onOpenScanBill={onOpenScanBill}
          onOpenApiKeyModal={onOpenApiKeyModal}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelectTab={onSelectTab}
        />

        <main className="page-content animate-fade-in">
          {children}
        </main>
      </div>

      <MobileNav 
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onOpenAddTxn={onOpenAddTxn}
      />
    </div>
  );
}
