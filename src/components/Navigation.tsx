import { useState } from 'react';
import {
  LayoutDashboard,
  Shield,
  Activity,
  ClipboardCheck,
  Users,
  BarChart3,
  History,
  Menu,
  X,
  Globe,
  GitCompare,
  RefreshCw,
  Calculator,
  Brain,
  TrendingUp,
  Radar,
  GitBranch,
  Grid3x3,
  ArrowLeftRight,
} from 'lucide-react';

const navItems = [
  { id: 'overview', label: '持仓总览', icon: LayoutDashboard },
  { id: 'execsummary', label: '综合诊断', icon: Activity },
  { id: 'rules', label: '仓位纪律', icon: Shield },
  { id: 'signals', label: '信号看板', icon: Activity },
  { id: 'advice', label: '调仓建议', icon: TrendingUp },
  { id: 'sop', label: '每日SOP', icon: ClipboardCheck },
  { id: 'managers', label: '经理评估', icon: Users },
  { id: 'logs', label: '操作日志', icon: History },
  { id: 'radar', label: '机会雷达', icon: Radar },
  { id: 'lifecycle', label: '生命周期', icon: GitBranch },
  { id: 'winrate', label: '胜率赔率', icon: Grid3x3 },
  { id: 'divergence', label: '背离监测', icon: ArrowLeftRight },
  { id: 'screener', label: '选基筛选', icon: BarChart3 },
  { id: 'macro', label: '宏观周期', icon: Globe },
  { id: 'correlation', label: '相关性', icon: GitCompare },
  { id: 'rebalance', label: '再平衡', icon: RefreshCw },
  { id: 'atr', label: 'ATR监控', icon: BarChart3 },
  { id: 'risk', label: '风险指标', icon: Shield },
  { id: 'cost', label: '交易成本', icon: Calculator },
  { id: 'behavior', label: '行为检查', icon: Brain },
];

interface NavigationProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

export function Navigation({ activeSection, onNavigate }: NavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <nav className="hidden md:flex items-center gap-1 bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-50">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">财富配置决策系统</h1>
            <p className="text-[10px] text-gray-500">V3.3 投资决策助手</p>
          </div>
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
        <div className="ml-auto text-xs text-gray-400">
          2026年7月15日
        </div>
      </nav>

      {/* Mobile */}
      <div className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">财富配置决策系统</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-gray-100 px-4 py-2 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm ${
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
