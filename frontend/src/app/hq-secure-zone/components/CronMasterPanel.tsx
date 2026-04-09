"use client";
import { useState } from "react";
import { triggerMaintenanceTask, forceGlobalLogout } from "../actions";

export default function CronMasterPanel() {
  const [taskRunning, setTaskRunning] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const runTask = async (taskName: string, label: string) => {
    if (!confirm(`Naozaj spustiť úlohu: ${label}?`)) return;
    setTaskRunning(taskName);
    try {
      const res = await triggerMaintenanceTask(taskName);
      alert(
        `✅ Úloha úspešne dokončená. Odpoveď backendu: ${res.message || "OK"}`
      );
    } catch (err: any) {
      alert(`❌ Chyba: ${err.message}`);
    } finally {
      setTaskRunning(null);
    }
  };

  const handleForceLogout = async () => {
    if (!confirm("🚨 Naozaj chcete okamžite odhlásiť VŠETKÝCH používateľov?"))
      return;
    setTaskRunning("force-logout");
    try {
      const res = await forceGlobalLogout();
      alert(`✅ ${res.message}`);
    } catch (err: any) {
      alert(`❌ Chyba: ${err.message}`);
    } finally {
      setTaskRunning(null);
    }
  };

  const allCronTasks = [
    { id: "training", label: "Push: Morning Training", group: "Notifications" },
    { id: "recovery", label: "Push: Recovery Tips", group: "Notifications" },
    { id: "review", label: "Push: Evening Review", group: "Notifications" },
    { id: "hourly-ping", label: "Test Hourly Ping", group: "Notifications" },
    {
      id: "weekly-athlete-state",
      label: "Force AI Refresh (50)",
      group: "AI & Plans",
    },
    {
      id: "daily-plan-completion",
      label: "Auto-Complete Plans",
      group: "AI & Plans",
    },
    { id: "apply-subscriptions", label: "Sync Subscriptions", group: "System" },
    {
      id: "cleanup-expired-activities",
      label: "Clean Expired Files",
      group: "System",
    },
    {
      id: "cleanup-deleted-activities",
      label: "Purge Deleted Data",
      group: "System",
    },
    {
      id: "account-hard-delete",
      label: "Hard Delete Accounts",
      group: "Danger",
    },
    {
      id: "check-ai-models",
      label: "Monitor AI Models Health",
      group: "AI & Plans",
    },
  ];

  return (
    <div className="bg-gray-900 border-t-4 border-red-600 rounded-b-2xl shadow-2xl overflow-hidden transition-all duration-300">
      
      {/* HLAVIČKA */}
      <div 
        className="p-6 md:p-8 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-red-600 font-black flex items-center gap-3 uppercase tracking-tighter text-xl italic">
          <span className="animate-pulse">🔴</span> Cron Master Operations
        </h3>
        
        <div className={`text-red-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* ROZBALENÝ OBSAH */}
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1500px] opacity-100 border-t border-gray-800' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCronTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => runTask(task.id, task.label)}
                disabled={!!taskRunning}
                className={`group flex flex-col items-start p-4 bg-black hover:bg-red-950/40 border transition-all disabled:opacity-20 rounded-2xl ${
                  task.group === "Danger"
                    ? "border-red-900/50 hover:border-red-600"
                    : "border-gray-800 hover:border-red-900/50"
                }`}
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                  {task.group}
                </span>
                <span className="text-xs font-black text-white uppercase tracking-tight">
                  {taskRunning === task.id ? "⚡ Running..." : task.label}
                </span>
              </button>
            ))}
          </div>
          
          <div className="mt-10 pt-8 border-t border-gray-800">
            <button
              onClick={handleForceLogout}
              disabled={!!taskRunning}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-6 rounded-2xl uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all active:scale-[0.98]"
            >
              🚨 Global Force Logout (Kicks everyone) 🚨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
