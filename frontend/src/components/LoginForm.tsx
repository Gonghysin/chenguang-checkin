import { useState, useCallback } from "react";
import { loginAdmin } from "../api/client";
import { LogIn, AlertCircle } from "lucide-react";

interface LoginFormProps {
  onSuccess: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        await loginAdmin(username, password);
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "登录失败";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [username, password, onSuccess]
  );

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        管理后台登录
      </h2>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            用户名
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="admin"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入密码"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <LogIn size={18} />
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
