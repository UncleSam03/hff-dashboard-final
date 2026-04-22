import React from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  LineChart,
  Bell,
  LogOut,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { cn } from "../lib/utils";

const Sidebar = ({
  activeTab = 'overview',
  onTabChange,
  onSignOut,
  userProfile,
  userRole,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'collect', label: 'Offline Collect', icon: ClipboardList },
    { id: 'hub', label: 'Campaign Hub', icon: Users },
    { id: 'analysis', label: 'Deep Analysis', icon: LineChart },
    { id: 'sat', label: 'SAT', icon: FileCheck },
  ];

  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'SM';

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-white border-r border-gray-100 z-50 flex flex-col shadow-sm ui-transition",
      isCollapsed ? "w-24" : "w-72"
    )}>
      {/* Brand Logo */}
      <div className={cn(
        "p-8 pb-6 flex items-center transition-all duration-300",
        isCollapsed ? "justify-center p-6" : "justify-between"
      )}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-10 h-10 min-w-[40px] rounded-2xl hff-gradient-bg flex items-center justify-center shadow-xl shadow-[#71167F]/20 transform rotate-3">
            <span className="text-white font-black text-xl">H</span>
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h1 className="text-xl font-black hff-gradient-text tracking-tight uppercase leading-none">HFF Impact</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Admin Portal</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle - Desktop Only */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden lg:flex p-1.5 rounded-lg border border-gray-100 text-gray-400 hover:text-[#71167F] hover:bg-gray-50 transition-all",
            isCollapsed && "absolute -right-3 top-7 bg-white shadow-md z-50"
          )}
        >
          <ChevronRight size={14} className={cn("transition-transform duration-300", !isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 mt-8 space-y-2 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : ""}
              className={cn(
                "w-full flex items-center px-4 py-4 rounded-2xl transition-all duration-300 group relative",
                isActive
                  ? "bg-[#71167F]/5 text-[#71167F] shadow-sm ring-1 ring-[#71167F]/10"
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#71167F]",
                isCollapsed && "justify-center px-0 py-4"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-xl transition-colors duration-300",
                  isActive ? "bg-[#71167F] text-white shadow-md shadow-[#71167F]/20" : "bg-gray-50 group-hover:bg-[#71167F]/10 group-hover:text-[#71167F]"
                )}>
                  <Icon size={18} />
                </div>
                {!isCollapsed && (
                  <span className={cn(
                    "font-black text-[11px] uppercase tracking-[0.15em] whitespace-nowrap animate-in fade-in duration-300",
                    isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"
                  )}>
                    {item.label}
                  </span>
                )}
              </div>
              {isActive && !isCollapsed && <ChevronRight size={14} className="text-[#71167F] ml-auto animate-in fade-in duration-300" />}

              {/* Active Indicator Dot for Collapsed Mode */}
              {isActive && isCollapsed && (
                <div className="absolute right-2 w-1 h-4 hff-gradient-bg rounded-full shadow-[0_0_8px_rgba(113,22,127,0.4)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/30">
        <div className={cn(
          "bg-white rounded-3xl flex items-center transition-all duration-300 border border-gray-100 shadow-sm group hover:shadow-md",
          isCollapsed ? "p-2 justify-center" : "p-4 gap-3"
        )}>
          <div className="w-10 h-10 min-w-[40px] rounded-2xl bg-[#71167F]/10 flex items-center justify-center text-[#71167F] font-black border border-[#71167F]/10 uppercase">
            {initials}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-[10px] font-black text-gray-900 truncate uppercase tracking-tight">
                  {userProfile?.full_name || "Sarah M."}
                </p>
                <p className="text-[9px] font-bold text-[#3EB049] uppercase tracking-widest opacity-80">
                  {userRole || "Administrator"}
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
