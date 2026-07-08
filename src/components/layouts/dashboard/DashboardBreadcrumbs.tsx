import { useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { NavigationCategory } from './getNavigationByRole';

interface DashboardBreadcrumbsProps {
  navigation: NavigationCategory[];
}

export function DashboardBreadcrumbs({ navigation }: DashboardBreadcrumbsProps) {
  const location = useLocation();
  const path = location.pathname;

  // Find active item and category
  let activeCategoryName = '';
  let activeItemName = 'Dashboard';

  for (const cat of navigation) {
    const found = cat.items.find(item => 
      item.exact ? path === item.href : path.startsWith(item.href)
    );
    if (found) {
      activeCategoryName = cat.category;
      activeItemName = found.name;
      break;
    }
  }

  return (
    <nav className="flex items-center space-x-1.5 text-zinc-400 font-sans text-xs select-none">
      <div className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors">
        <Home className="w-3.5 h-3.5 text-[#D4AF37]" />
        <span className="font-medium">LumièreOS</span>
      </div>
      
      {activeCategoryName && (
        <>
          <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-zinc-500 font-light truncate max-w-[100px] sm:max-w-none">
            {activeCategoryName}
          </span>
        </>
      )}

      {activeItemName && (
        <>
          <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-white font-semibold truncate max-w-[120px] sm:max-w-none">
            {activeItemName}
          </span>
        </>
      )}
    </nav>
  );
}
