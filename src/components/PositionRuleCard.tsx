import { CheckCircle2, AlertTriangle, XCircle, ArrowDownCircle } from 'lucide-react';
import type { PositionRule } from '@/types';

interface PositionRuleCardProps {
  rule: PositionRule;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    className: 'text-green-600 bg-green-50 border-green-200',
    label: '通过',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    label: '预警',
  },
  danger: {
    icon: XCircle,
    className: 'text-red-600 bg-red-50 border-red-200',
    label: '超限',
  },
  low: {
    icon: ArrowDownCircle,
    className: 'text-orange-600 bg-orange-50 border-orange-200',
    label: '偏低',
  },
};

export function PositionRuleCard({ rule }: PositionRuleCardProps) {
  const isMin = rule.type === 'min';

  // 下限规则特殊处理：currentValue < limit 显示"偏低"
  const effectiveStatus = isMin && rule.currentValue < rule.limit
    ? 'low' as const
    : rule.status;

  const { icon: Icon, className, label } = statusConfig[effectiveStatus];

  // 上限规则：百分比 = current/limit（超过100%表示超限）
  // 下限规则：百分比 = current/limit（低于100%表示偏低）
  const percent = Math.min((rule.currentValue / rule.limit) * 100, 100);

  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{rule.name}</span>
        <div className="flex items-center gap-1">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-semibold">{label}</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-2xl font-bold ${effectiveStatus === 'low' ? 'text-orange-700' : ''}`}>
          {rule.currentValue}{rule.unit}
        </span>
        <span className="text-xs opacity-70">
          {isMin ? '下限' : '上限'} {rule.limit}{rule.unit}
        </span>
      </div>
      <div className="w-full bg-white/50 rounded-full h-2 relative">
        {/* 参考线标记limit位置 */}
        <div
          className={`h-2 rounded-full transition-all ${
            effectiveStatus === 'pass' ? 'bg-green-500' :
            effectiveStatus === 'low' ? 'bg-orange-500' :
            effectiveStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {effectiveStatus === 'low' && (
        <div className="mt-1.5 text-[10px] text-orange-700 bg-orange-100 rounded px-1.5 py-0.5">
          低于下限 {rule.limit}%，需补充{isMin ? '防御' : ''}仓位
        </div>
      )}
    </div>
  );
}
