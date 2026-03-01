import React, { Suspense } from "react";
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
import IngestDashboard from "./pages/IngestDashboard";
import IngestWizard from "./pages/IngestWizard";
import IngestPage from "./pages/IngestPage";
const AdminFormsListPage = React.lazy(() => import("./pages/admin/AdminFormsListPage"));
const AdminFormBuilderPage = React.lazy(() => import("./pages/admin/AdminFormBuilderPage"));
const ReviewDashboard = React.lazy(() => import("./pages/ReviewDashboard"));
import Forms from "./pages/Forms";
import FormDetail from "./pages/FormDetail";
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
            {/* Forms */}
            <Route path="/forms" element={
              <ProtectedRoute>
                <Forms />
              </ProtectedRoute>
            } />
            <Route path="/forms/:slug" element={
              <ProtectedRoute>
                <FormDetail />
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

            {/* Data Ingestion - requires admin role */}
            <Route path="/admin/ingest" element={
              <ProtectedRoute requiredRole="admin">
                <IngestDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/ingest/new" element={
              <ProtectedRoute requiredRole="admin">
                <IngestWizard />
              </ProtectedRoute>
            } />
            <Route path="/admin/ingest/:sessionId" element={
              <ProtectedRoute requiredRole="admin">
                <IngestPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/ingest/edit/:table/:productId" element={
              <ProtectedRoute requiredRole="admin">
                <IngestPage />
              </ProtectedRoute>
            } />
            
            {/* Form Builder Admin - requires manager or admin role (lazy-loaded) */}
            <Route path="/admin/forms" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminFormsListPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/admin/forms/new" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminFormBuilderPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/admin/forms/:id/edit" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminFormBuilderPage />
                </Suspense>
              </ProtectedRoute>
            } />

            {/* Review Insights Dashboard - requires manager or admin role (lazy-loaded) */}
            <Route path="/admin/reviews" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <ReviewDashboard />
                </Suspense>
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
