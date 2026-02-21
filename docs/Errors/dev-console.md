⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
warnOnce	@	react-router-dom.js?v=914dcb60:4393

react-router-dom.js?v=914dcb60:4393 ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.
2
PrepRecipeEditor.tsx?t=1771594624343:532 Uncaught ReferenceError: Save is not defined
    at PrepRecipeEditor (PrepRecipeEditor.tsx…771594624343:532:51)
chunk-T2SWDQEL.js?v=914dcb60:14032 The above error occurred in the <PrepRecipeEditor> component:

    at PrepRecipeEditor (http://localhost:8080/src/components/ingest/editor/PrepRecipeEditor.tsx?t=1771594624343:33:33)
    at div
    at div
    at div
    at div
    at PageTransition (http://localhost:8080/src/components/layout/PageTransition.tsx:25:38)
    at main
    at ContentArea (http://localhost:8080/src/components/layout/ContentArea.tsx:23:31)
    at div
    at div
    at div
    at AppShell (http://localhost:8080/src/components/layout/AppShell.tsx?t=1771594360677:29:28)
    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771594083632:46:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771537540066:466:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=914dcb60:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=914dcb60:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=914dcb60:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
PrepRecipeEditor.tsx?t=1771594624343:532 Uncaught (in promise) ReferenceError: Save is not defined
    at PrepRecipeEditor (PrepRecipeEditor.tsx…771594624343:532:51)
2
IngestDraftContext.t…t=1771537540066:486 Uncaught Error: useIngestDraft must be used within IngestDraftProvider
    at useIngestDraft (IngestDraftContext.t…771537540066:486:21)
    at IngestPageInner (IngestPage.tsx?t=1771594645814:52:33)
chunk-T2SWDQEL.js?v=914dcb60:14032 The above error occurred in the <IngestPageInner> component:

    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771594645814:48:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771595156852:466:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=914dcb60:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=914dcb60:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=914dcb60:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
IngestDraftContext.t…t=1771537540066:486 Uncaught (in promise) Error: useIngestDraft must be used within IngestDraftProvider
    at useIngestDraft (IngestDraftContext.t…771537540066:486:21)
    at IngestPageInner (IngestPage.tsx?t=1771594645814:52:33)
2
IngestPage.tsx?t=1771595276542:290 Uncaught ReferenceError: handleFileSelected is not defined
    at IngestPageInner (IngestPage.tsx?t=1771595276542:290:25)
chunk-T2SWDQEL.js?v=914dcb60:14032 The above error occurred in the <IngestPageInner> component:

    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771595276542:48:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771595156852:466:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=914dcb60:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=914dcb60:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=914dcb60:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
IngestPage.tsx?t=1771595276542:290 Uncaught (in promise) ReferenceError: handleFileSelected is not defined
    at IngestPageInner (IngestPage.tsx?t=1771595276542:290:25)
2
IngestPage.tsx?t=1771595282566:333 Uncaught ReferenceError: handleFileSelected is not defined
    at IngestPageInner (IngestPage.tsx?t=1771595282566:333:33)
chunk-T2SWDQEL.js?v=914dcb60:14032 The above error occurred in the <IngestPageInner> component:

    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771595282566:48:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771595156852:466:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=914dcb60:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=914dcb60:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=914dcb60:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
chunk-T2SWDQEL.js?v=914dcb60:19413 Uncaught ReferenceError: handleFileSelected is not defined
    at IngestPageInner (IngestPage.tsx?t=1771595282566:333:33)
2
AllergenBadge.tsx:17 Uncaught TypeError: Cannot read properties of undefined (reading 'color')
    at AllergenBadge (AllergenBadge.tsx:17:16)
chunk-T2SWDQEL.js?v=914dcb60:14032 The above error occurred in the <AllergenBadge> component:

    at AllergenBadge (http://localhost:8080/src/components/recipes/AllergenBadge.tsx:23:33)
    at span
    at div
    at li
    at ul
    at div
    at div
    at IngredientsColumn (http://localhost:8080/src/components/recipes/IngredientsColumn.tsx:28:37)
    at div
    at div
    at div
    at IngestPreview (http://localhost:8080/src/components/ingest/IngestPreview.tsx?t=1771536798328:29:33)
    at div
    at div
    at div
    at div
    at PageTransition (http://localhost:8080/src/components/layout/PageTransition.tsx:25:38)
    at main
    at ContentArea (http://localhost:8080/src/components/layout/ContentArea.tsx:23:31)
    at div
    at div
    at div
    at AppShell (http://localhost:8080/src/components/layout/AppShell.tsx?t=1771594360677:29:28)
    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771596014973:48:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771595925813:471:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=914dcb60:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=914dcb60:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=914dcb60:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=914dcb60:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
chunk-T2SWDQEL.js?v=914dcb60:9129 Uncaught TypeError: Cannot read properties of undefined (reading 'color')
    at AllergenBadge (AllergenBadge.tsx:17:16)
