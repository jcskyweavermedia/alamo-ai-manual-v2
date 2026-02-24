react-router-dom.js?v=e86e23f7:4393 ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
warnOnce @ react-router-dom.js?v=e86e23f7:4393Understand this warning
react-router-dom.js?v=e86e23f7:4393 ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.
warnOnce @ react-router-dom.js?v=e86e23f7:4393Understand this warning
2chunk-T2SWDQEL.js?v=e86e23f7:11595 Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
    at renderWithHooks (chunk-T2SWDQEL.js?v=e86e23f7:11595:19)
    at updateFunctionComponent (chunk-T2SWDQEL.js?v=e86e23f7:14582:28)
    at beginWork (chunk-T2SWDQEL.js?v=e86e23f7:15924:22)
    at HTMLUnknownElement.callCallback2 (chunk-T2SWDQEL.js?v=e86e23f7:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-T2SWDQEL.js?v=e86e23f7:3699:24)
    at invokeGuardedCallback (chunk-T2SWDQEL.js?v=e86e23f7:3733:39)
    at beginWork$1 (chunk-T2SWDQEL.js?v=e86e23f7:19765:15)
    at performUnitOfWork (chunk-T2SWDQEL.js?v=e86e23f7:19198:20)
    at workLoopSync (chunk-T2SWDQEL.js?v=e86e23f7:19137:13)
    at renderRootSync (chunk-T2SWDQEL.js?v=e86e23f7:19116:15)Understand this error
chunk-T2SWDQEL.js?v=e86e23f7:14032 The above error occurred in the <TranslationBadge> component:

    at TranslationBadge (http://localhost:8080/src/components/ingest/TranslationBadge.tsx?t=1771867349506:38:36)
    at span
    at button
    at http://localhost:8080/node_modules/.vite/deps/chunk-LKOAR5GC.js?v=e86e23f7:43:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-KRMGTXDK.js?v=e86e23f7:80:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-E7TSFT4J.js?v=e86e23f7:79:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-E7TSFT4J.js?v=e86e23f7:56:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-W2OT6ZD3.js?v=e86e23f7:53:15
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:289:13
    at h3
    at http://localhost:8080/node_modules/.vite/deps/chunk-LKOAR5GC.js?v=e86e23f7:43:13
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:270:13
    at _c2 (http://localhost:8080/src/components/ui/accordion.tsx:37:66)
    at div
    at http://localhost:8080/node_modules/.vite/deps/chunk-LKOAR5GC.js?v=e86e23f7:43:13
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at http://localhost:8080/node_modules/.vite/deps/chunk-KRMGTXDK.js?v=e86e23f7:42:7
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:229:13
    at _c (http://localhost:8080/src/components/ui/accordion.tsx:26:62)
    at div
    at http://localhost:8080/node_modules/.vite/deps/chunk-LKOAR5GC.js?v=e86e23f7:43:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-E7TSFT4J.js?v=e86e23f7:79:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-E7TSFT4J.js?v=e86e23f7:56:13
    at http://localhost:8080/node_modules/.vite/deps/chunk-W2OT6ZD3.js?v=e86e23f7:41:15
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:133:13
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:99:12
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at CollectionProvider (http://localhost:8080/node_modules/.vite/deps/chunk-W2OT6ZD3.js?v=e86e23f7:31:13)
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-accordion.js?v=e86e23f7:57:13
    at div
    at PrepRecipeEditor (http://localhost:8080/src/components/ingest/editor/PrepRecipeEditor.tsx?t=1771867349506:37:33)
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
    at AppShell (http://localhost:8080/src/components/layout/AppShell.tsx?t=1771717035723:29:28)
    at IngestPageInner (http://localhost:8080/src/pages/IngestPage.tsx?t=1771867349506:86:39)
    at IngestDraftProvider (http://localhost:8080/src/contexts/IngestDraftContext.tsx?t=1771867018030:675:39)
    at IngestPage
    at ProtectedRoute (http://localhost:8080/src/components/auth/ProtectedRoute.tsx:30:34)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e86e23f7:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e86e23f7:4558:5)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e86e23f7:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e86e23f7:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-OXZDJRWN.js?v=e86e23f7:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=e86e23f7:64:5)
    at AuthProvider (http://localhost:8080/src/components/auth/AuthProvider.tsx:34:32)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=e86e23f7:2934:3)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
logCapturedError @ chunk-T2SWDQEL.js?v=e86e23f7:14032Understand this error
chunk-T2SWDQEL.js?v=e86e23f7:19413 Uncaught Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
    at renderWithHooks (chunk-T2SWDQEL.js?v=e86e23f7:11595:19)
    at updateFunctionComponent (chunk-T2SWDQEL.js?v=e86e23f7:14582:28)
    at beginWork (chunk-T2SWDQEL.js?v=e86e23f7:15924:22)
    at beginWork$1 (chunk-T2SWDQEL.js?v=e86e23f7:19753:22)
    at performUnitOfWork (chunk-T2SWDQEL.js?v=e86e23f7:19198:20)
    at workLoopSync (chunk-T2SWDQEL.js?v=e86e23f7:19137:13)
    at renderRootSync (chunk-T2SWDQEL.js?v=e86e23f7:19116:15)
    at recoverFromConcurrentError (chunk-T2SWDQEL.js?v=e86e23f7:18736:28)
    at performConcurrentWorkOnRoot (chunk-T2SWDQEL.js?v=e86e23f7:18684:30)
    at workLoop (chunk-T2SWDQEL.js?v=e86e23f7:197:42)