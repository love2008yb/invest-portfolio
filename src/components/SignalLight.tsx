import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { SignalStatus } from '@/types';

interface SignalLightProps {
  status: SignalStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const config = {
  green: {
    icon: CheckCircle2,
    className: 'text-green-500',
    bgClass: 'bg-green-50 border-green-200',
    label: '绿灯',
  },
  yellow: {
    icon: AlertCircle,
    className: 'text-yellow-500',
    bgClass: 'bg-yellow-50 border-yellow-200',
    label: '黄灯',
  },
  red: {
    icon: XCircle,
    className: 'text-red-500',
    bgClass: 'bg-red-50 border-red-200',
    label: '红灯',
  },
};

export function SignalLight({ status, label, size = 'md' }: SignalLightProps) {
  const { icon: Icon, className, bgClass } = config[status];
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${bgClass}`}>
      <Icon className={`${sizeMap[size]} ${className}`} />
      {label && <span className={`text-sm font-medium ${className}`}>{label}</span>}
    </div>
  );
}
