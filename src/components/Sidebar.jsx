import React from 'react';
import {
  LayoutDashboard,
  Users,
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
    { id: 'hub', label: 'Campaign Hub', icon: Users },
    { id: 'analysis', label: 'Deep Analysis', icon: LineChart },
    { id: 'sat', label: 'SAT', icon: FileCheck },
  ];

  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'SM';

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen liquid-glass-sidebar z-50 flex flex-col shadow-xl shadow-purple-950/5 ui-transition",
      isCollapsed ? "w-24" : "w-72"
    )}>
      {/* Brand Logo */}
      <div className={cn(
        "p-8 pb-6 flex items-center transition-all duration-300",
        isCollapsed ? "justify-center p-6" : "justify-between"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 min-w-[40px] rounded-2xl hff-gradient-bg flex items-center justify-center shadow-lg shadow-[#71167F]/25 transform rotate-2 border border-white/40">
            <span className="text-white font-black text-xl">H</span>
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h1 className="text-xl font-bold hff-gradient-text tracking-tight uppercase leading-none">HFF Impact</h1>
              <p className="text-[10px] font-semibold text-gray-400 tracking-wider mt-1">Admin Portal</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle - Desktop Only */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden lg:flex p-1.5 rounded-full liquid-glass-pill border border-white/80 text-gray-400 hover:text-[#71167F] transition-all",
            isCollapsed && "absolute -right-3.5 top-7 shadow-md z-50 bg-white"
          )}
        >
          <ChevronRight size={14} className={cn("transition-transform duration-300", !isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 mt-6 space-y-2.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={isCollapsed ? item.label : ""}
              className={cn(
                "w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                isActive
                  ? "liquid-glass-active shadow-sm"
                  : "text-gray-600 hover:bg-white/60 hover:text-[#71167F]",
                isCollapsed && "justify-center px-0 py-3.5"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-[#71167F] text-white shadow-md shadow-[#71167F]/25 scale-105" 
                    : "bg-white/70 text-gray-500 border border-white/60 group-hover:bg-[#71167F]/10 group-hover:text-[#71167F]"
                )}>
                  <Icon size={17} />
                </div>
                {!isCollapsed && (
                  <span className={cn(
                    "font-bold text-[11px] tracking-wider uppercase whitespace-nowrap animate-in fade-in duration-300",
                    isActive ? "opacity-100 font-extrabold" : "opacity-75 group-hover:opacity-100"
                  )}>
                    {item.label}
                  </span>
                )}
              </div>
              {isActive && !isCollapsed && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#71167F] ml-auto animate-in fade-in duration-300 shadow-[0_0_8px_rgba(113,22,127,0.6)]" />
              )}

              {/* Active Indicator Dot for Collapsed Mode */}
              {isActive && isCollapsed && (
                <div className="absolute right-2 w-1.5 h-4 hff-gradient-bg rounded-full shadow-[0_0_8px_rgba(113,22,127,0.5)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/40 bg-white/20">
        <div className={cn(
          "glass-card flex items-center transition-all duration-300 border border-white/70 shadow-sm group hover:shadow-md",
          isCollapsed ? "p-2 justify-center" : "p-3.5 gap-3"
        )}>
          <div className="w-10 h-10 min-w-[40px] rounded-xl bg-gradient-to-br from-[#71167F]/15 to-[#3EB049]/15 flex items-center justify-center text-[#71167F] font-black border border-white/60 shadow-inner uppercase">
            {initials}
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <p className="text-[11px] font-bold text-gray-900 truncate tracking-tight">
                  {userProfile?.full_name || "Sarah M."}
                </p>
                <p className="text-[9px] font-semibold text-[#3EB049] tracking-wider uppercase opacity-90">
                  {userRole || "Administrator"}
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50/60 rounded-xl transition-all"
                title="Sign out"
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
