import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NutritionProvider } from './NutritionContext';
import { pageFromPath } from './nav';
import { HubPage } from './HubPage';
import { DiaryPage } from './DiaryPage';
import { AddFoodPage } from './AddFoodPage';
import { CustomFoodPage } from './CustomFoodPage';
import { NutrientsPage } from './NutrientsPage';
import { PlanPage } from './PlanPage';
import { WeightPage } from './WeightPage';
import { CoachPage } from './CoachPage';
import { LibraryPage } from './LibraryPage';
import { ReportsPage } from './ReportsPage';
import { CheckInPage } from './CheckInPage';
import { RecipesPage } from './RecipesPage';
import { GoalPage } from './GoalPage';

/** The Nutrition tab: one provider (shared data) and a page per sub-path. */
export function NutritionSection() {
  return (
    <NutritionProvider>
      <NutritionPages />
    </NutritionProvider>
  );
}

function NutritionPages() {
  const location = useLocation();
  const page = pageFromPath(location.pathname);
  const article = new URLSearchParams(location.search).get('a');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page, article]);

  switch (page) {
    case 'diary':
      return <DiaryPage />;
    case 'add':
      return <AddFoodPage />;
    case 'food':
      return <CustomFoodPage />;
    case 'nutrients':
      return <NutrientsPage />;
    case 'plan':
      return <PlanPage />;
    case 'weight':
      return <WeightPage />;
    case 'coach':
      return <CoachPage />;
    case 'library':
      return <LibraryPage />;
    case 'reports':
      return <ReportsPage />;
    case 'check-in':
      return <CheckInPage />;
    case 'recipes':
      return <RecipesPage />;
    case 'goal':
      return <GoalPage />;
    default:
      return <HubPage />;
  }
}
