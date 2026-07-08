import { Outlet } from 'react-router-dom';
import { DemoRoleSwitcher } from '../../DemoRoleSwitcher';

export function DashboardWorkspace() {
  return (
    <div className="relative w-full space-y-6">
      {/* Dynamic role selector for live simulation */}
      <DemoRoleSwitcher />
      
      {/* Router Viewport Area */}
      <Outlet />
    </div>
  );
}
