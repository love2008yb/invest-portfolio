import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

const CORRECT_PASSWORD = 'v321';

interface PasswordGateProps {
  children: React.ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [input, setInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('invest_auth') === 'true';
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      sessionStorage.setItem('invest_auth', 'true');
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setInput('');
    }
  };

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">财富配置决策系统</h1>
          <p className="text-sm text-gray-500 mt-1">V3.3 投资决策助手</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              请输入访问密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(false);
                }}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 pr-10 ${
                  error
                    ? 'border-red-300 focus:ring-red-200 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                }`}
                placeholder="输入密码..."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1.5">密码错误，请重试</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            进入系统
          </button>
        </form>

        <p className="text-[10px] text-gray-400 text-center mt-4">
          仅供授权用户访问 | 投资有风险，决策需谨慎
        </p>
      </div>
    </div>
  );
}
