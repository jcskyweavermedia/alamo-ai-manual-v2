import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/components/auth";
import { UnitProvider } from "@/contexts/UnitContext";
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
import CoursesPage from "./pages/CoursesPage";
import CoursePlayerPage from "./pages/CoursePlayerPage";
import IngestDashboard from "./pages/IngestDashboard";
import IngestWizard from "./pages/IngestWizard";
import IngestPage from "./pages/IngestPage";
const AdminFormsListPage = React.lazy(() => import("./pages/admin/AdminFormsListPage"));
const AdminFormBuilderPage = React.lazy(() => import("./pages/admin/AdminFormBuilderPage"));
const AdminCourseListPage = React.lazy(() => import("./pages/admin/AdminCourseListPage"));
const AdminCourseBuilderPage = React.lazy(() => import("./pages/admin/AdminCourseBuilderPage"));
const AdminTrainingDashboardPage = React.lazy(() => import("./pages/admin/AdminTrainingDashboardPage"));
const ReviewDashboard = React.lazy(() => import("./pages/ReviewDashboard"));
const FormSubmissionView = React.lazy(() => import("./pages/FormSubmissionView"));
import Forms from "./pages/Forms";
import FormDetail from "./pages/FormDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UnitProvider>
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
            {/* Courses */}
            <Route path="/courses" element={
              <ProtectedRoute>
                <CoursesPage />
              </ProtectedRoute>
            } />
            <Route path="/courses/:slug" element={
              <ProtectedRoute>
                <CoursePlayerPage />
              </ProtectedRoute>
            } />
            {/* Forms */}
            <Route path="/forms" element={
              <ProtectedRoute>
                <Forms />
              </ProtectedRoute>
            } />
            <Route path="/forms/view/:submissionId" element={
              <ProtectedRoute>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <FormSubmissionView />
                </Suspense>
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

            {/* Admin route - requires manager or admin role */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Admin />
              </ProtectedRoute>
            } />

            {/* Training Dashboard - requires manager or admin role (lazy-loaded) */}
            <Route path="/admin/training" element={
              <ProtectedRoute requiredRole={['manager', 'admin']}>
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminTrainingDashboardPage />
                </Suspense>
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

            {/* Course Builder Admin - requires admin role (lazy-loaded) */}
            <Route path="/admin/courses" element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminCourseListPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/admin/courses/new" element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminCourseBuilderPage />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/admin/courses/:id/edit" element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
                  <AdminCourseBuilderPage />
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
      </UnitProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
