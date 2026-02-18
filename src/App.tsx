import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/components/auth";
import Index from "./pages/Index";
import Manual from "./pages/Manual";
import SearchPage from "./pages/SearchPage";
import Ask from "./pages/Ask";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import SignIn from "./pages/SignIn";
import JoinGroup from "./pages/JoinGroup";
import Recipes from "./pages/Recipes";
import DishGuide from "./pages/DishGuide";
import Wines from "./pages/Wines";
import Cocktails from "./pages/Cocktails";
import BeerLiquor from "./pages/BeerLiquor";
import StepsOfService from "./pages/StepsOfService";
import TrainingHome from "./pages/TrainingHome";
import ProgramDetail from "./pages/ProgramDetail";
import CourseDetail from "./pages/CourseDetail";
import LearningSession from "./pages/LearningSession";
import QuizPage from "./pages/QuizPage";
import ModuleTestPage from "./pages/ModuleTestPage";
import PracticeTutorPage from "./pages/PracticeTutorPage";
import ManagerTrainingDashboard from "./pages/ManagerTrainingDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/join/:slug" element={<JoinGroup />} />
            
            {/* Protected routes - require authentication */}
            <Route path="/manual" element={
              <ProtectedRoute>
                <Manual />
              </ProtectedRoute>
            } />
            <Route path="/manual/:sectionId" element={
              <ProtectedRoute>
                <Manual />
              </ProtectedRoute>
            } />
            <Route path="/search" element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            } />
            <Route path="/recipes" element={
              <ProtectedRoute>
                <Recipes />
              </ProtectedRoute>
            } />
            <Route path="/dish-guide" element={
              <ProtectedRoute>
                <DishGuide />
              </ProtectedRoute>
            } />
            <Route path="/wines" element={
              <ProtectedRoute>
                <Wines />
              </ProtectedRoute>
            } />
            <Route path="/cocktails" element={
              <ProtectedRoute>
                <Cocktails />
              </ProtectedRoute>
            } />
            <Route path="/beer-liquor" element={
              <ProtectedRoute>
                <BeerLiquor />
              </ProtectedRoute>
            } />
            <Route path="/foh-manuals" element={
              <ProtectedRoute>
                <StepsOfService />
              </ProtectedRoute>
            } />
            <Route path="/courses" element={
              <ProtectedRoute>
                <TrainingHome />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug" element={
              <ProtectedRoute>
                <ProgramDetail />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug/:courseSlug" element={
              <ProtectedRoute>
                <CourseDetail />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug/:courseSlug/test" element={
              <ProtectedRoute>
                <ModuleTestPage />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug/:courseSlug/practice" element={
              <ProtectedRoute>
                <PracticeTutorPage />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug/:courseSlug/:sectionSlug" element={
              <ProtectedRoute>
                <LearningSession />
              </ProtectedRoute>
            } />
            <Route path="/courses/:programSlug/:courseSlug/:sectionSlug/quiz" element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            } />
            <Route path="/ask" element={
              <ProtectedRoute>
                <Ask />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            
            {/* Admin route - requires admin role */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <Admin />
              </ProtectedRoute>
            } />

            {/* Manager Training Dashboard - requires manager role */}
            <Route path="/admin/training" element={
              <ProtectedRoute requiredRole="manager">
                <ManagerTrainingDashboard />
              </ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
