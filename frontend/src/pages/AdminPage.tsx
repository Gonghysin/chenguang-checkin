import { useState, useEffect } from "react";
import LoginForm from "../components/LoginForm";
import DataTable from "../components/DataTable";
import { getAdminMe, logoutAdmin } from "../api/client";

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getAdminMe()
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // ignore
    }
    setIsLoggedIn(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <LoginForm onSuccess={() => setIsLoggedIn(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">晨光打卡管理</h1>
        </div>
        <DataTable onLogout={handleLogout} />
      </div>
    </div>
  );
}
