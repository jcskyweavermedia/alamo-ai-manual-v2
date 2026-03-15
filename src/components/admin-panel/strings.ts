// =============================================================================
// Admin Panel — Bilingual UI strings (EN / ES)
// =============================================================================

export const ADMIN_STRINGS = {
  en: {
    // Shell / navigation
    adminPanel: 'Admin Panel',
    alamoPrime: 'Alamo Prime',
    ourTeam: 'Our Team',
    courses: 'Courses',
    aiHub: 'AI Hub',
    coursesPlaceholder: 'Courses view coming soon',
    hubPlaceholder: 'AI Hub coming soon',

    // People view — hero banner
    heroTitle: 'Team Overview',
    heroSubtitle: 'Monitor performance, training progress, and team insights',
    heroTotalStaff: 'Total Staff',
    heroActive: 'Active',
    heroNewHires: 'New Hires',
    heroAvgScore: 'Avg Score',
    ourTeamSubtitle: 'Every great meal starts with a great team. See who\'s growing.',
    total: 'Total',
    newHires: 'New Hires',
    behind: 'Behind',
    trained: 'Trained',

    // People view — sections & cards
    newHiresTitle: 'New Hires',
    newHiresSubtitle: 'Started < 30 days ago',
    startedLessThan30Days: 'Started < 30 days ago',
    people: 'people',
    needsAttention: 'Needs Attention',
    allStaff: 'All Staff',
    employees: 'employees',
    searchPeople: 'Search people...',
    searchStaff: 'Search staff...',
    all: 'All',
    server: 'Server',
    host: 'Host',
    busser: 'Busser',
    runner: 'Runner',
    cook: 'Cook',
    bartender: 'Bartender',
    knowledgeLeaderboard: 'Knowledge Leaderboard',
    thisMonth: 'This month',
    pts: 'pts',
    viewFullLeaderboard: 'View full leaderboard \u2192',
    activeContest: 'Active Contest',
    prize: 'Prize',
    complete: 'complete',
    daysLeft: 'days left',
    participants: 'participants',
    aiInsight: 'AI Insight',
    aiInsightText:
      '3 new hires are falling behind on their Server 101 modules. Consider sending a reminder or scheduling a check-in to help them catch up before Week 3.',
    sendReminder: 'Send Reminder',
    dismiss: 'Dismiss',
    week: 'Week',
    of: 'of',

    // Courses view — hero banner
    active: 'Active',
    completion: 'Completion',
    avgGrade: 'Avg Grade',
    newHireReq: 'New Hire Req.',

    // Courses view — sidebar & detail
    searchCourses: 'Search courses...',
    allCourses: 'All',
    newHireCourses: 'New Hire',
    foh: 'FOH',
    boh: 'BOH',
    enrolled: 'Enrolled',
    completed: 'Completed',
    inProgress: 'In Progress',
    notStarted: 'Not Started',
    modules: 'modules',
    sections: 'sections',
    overdue: 'Overdue',
    stuck: 'Stuck',
    failedQuiz: 'Failed Quiz',
    stalled: 'Stalled',
    selectCourse: 'Select a course',
    selectCourseDesc: 'Choose a course from the sidebar to view details.',

    // AI Hub — hero banner
    aiTrainingManager: 'AI Training Manager',
    aiHubSubtitle:
      'Your AI assistant runs training programs, creates contests, assigns courses based on tenure, and keeps your team growing \u2014 automatically. You just approve.',
    staffManaged: 'Staff Managed',
    activeCourses: 'Active Courses',
    contestsRunning: 'Contests Running',

    // AI Hub — weekly update
    weeklyManagerUpdate: 'Weekly Manager Update',
    weeklyUpdateDesc:
      'New hires, course rollout, contests, and what\'s coming \u2014 ready for your meeting.',

    // AI Hub — suggestions
    aiSuggestions: 'AI Suggestions',
    pending: 'pending',
    approve: 'Approve',
    edit: 'Edit',
    skip: 'Skip',
    adjustReward: 'Adjust Reward',
    sendNudge: 'Send Nudge',

    // AI Hub — contests
    activeContests: 'Active Contests',
    createContest: 'Create Contest',
    live: 'Live',
    leading: 'Leading',

    // AI Hub — growth paths
    growthPaths: 'Growth Paths',
    aiManagedProgression: 'AI-managed progression',
    currentlyInTier: 'currently in this tier',

    // AI Hub — what's next / rewards / ask
    whatsNext: 'What\'s Next',
    generate12MonthPlan: 'Generate 12-Month Plan',
    rewardBank: 'Reward Bank',
    manage: 'Manage',
    usedThisMonth: 'used this month',
    askAi: 'Ask AI',
    askAiPlaceholder: 'Ask AI... e.g. "Create a 3-month contest plan focusing on wine"',

    // Employee overlay — header
    backTo: 'Back to',
    avgScore: 'Avg Score',
    grade: 'Grade',
    coursesDone: 'Courses Done',
    learnSpeedLabel: 'Learn Speed',

    // Employee overlay — course detail
    aiAnalysis: 'AI Analysis',
    moduleResults: 'Module Results',
    attemptHistory: 'ATTEMPT HISTORY',
    struggleWith: 'Struggled with',
    aiCourseSummary: 'AI Course Summary',
    recommendation: 'Recommendation',
    vsCohortAvg: 'vs. Cohort Average',

    // Employee overlay — quick actions
    quickActions: 'Quick Actions',
    schedule1on1: 'Schedule 1-on-1',
    sendResource: 'Send Resource',
    nudge: 'Nudge',
    addNote: 'Add Note',
    assignCourse: 'Assign Course',

    // Employee overlay — AI analysis tab
    snapshot: 'Snapshot',
    strengths: 'Strengths',
    areasToDevelop: 'Areas to Develop',
    growthTrajectory: 'Growth Trajectory',
    aiPrediction: 'AI Prediction',
    riskLevel: 'Risk Level',
    potential: 'Potential',
    attempts: 'attempts',
    attempt: 'attempt',
    unlocks: 'Unlocks after',

    // Weekly update overlay
    backToAiHub: 'Back to AI Hub',
    weeklyUpdate: 'Weekly Update',
    weekOf: 'Week of',

    // Manager chat
    managerChatWelcome: 'Ask me about your team\'s training',
    managerChatHint: 'Try: "How is my team doing?" or "Who needs attention?"',

    // AI Feedback / Evaluations
    aiFeedback: 'AI Feedback',
    noEvaluations: 'No evaluations yet',
    noEvaluationsHint: 'Evaluations will appear here as employees complete training assessments.',
    retry: 'Try again',

    // Notifications (Phase D)
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    noNotificationsHint: 'You\'re all caught up',

    // Notification types (Phase D)
    notificationAssignment: 'New Assignment',
    notificationNudge: 'Training Reminder',
    notificationReminder: 'Reminder',
    notificationAnnouncement: 'Announcement',

    // Suggestion / action strings (Phase D)
    noPendingSuggestions: 'No pending suggestions',
    noPendingSuggestionsHint: 'AI suggestions will appear here when available',
    approved: 'Approved',
    skipped: 'Skipped',
  },

  es: {
    // Shell / navigation
    adminPanel: 'Panel Admin',
    alamoPrime: 'Alamo Prime',
    ourTeam: 'Nuestro Equipo',
    courses: 'Cursos',
    aiHub: 'IA Hub',
    coursesPlaceholder: 'Vista de cursos pr\u00f3ximamente',
    hubPlaceholder: 'AI Hub pr\u00f3ximamente',

    // People view — hero banner
    heroTitle: 'Resumen del Equipo',
    heroSubtitle: 'Monitorea rendimiento, progreso de capacitaci\u00f3n e insights del equipo',
    heroTotalStaff: 'Personal Total',
    heroActive: 'Activos',
    heroNewHires: 'Nuevos',
    heroAvgScore: 'Puntaje Prom.',
    ourTeamSubtitle: 'Cada gran comida comienza con un gran equipo. Mira qui\u00e9n est\u00e1 creciendo.',
    total: 'Total',
    newHires: 'Nuevos',
    behind: 'Atrasados',
    trained: 'Capacitados',

    // People view — sections & cards
    newHiresTitle: 'Nuevos Empleados',
    newHiresSubtitle: 'Inicio < 30 d\u00edas',
    startedLessThan30Days: 'Inicio < 30 d\u00edas',
    people: 'personas',
    needsAttention: 'Requiere Atenci\u00f3n',
    allStaff: 'Todo el Personal',
    employees: 'empleados',
    searchPeople: 'Buscar personas...',
    searchStaff: 'Buscar personal...',
    all: 'Todos',
    server: 'Mesero',
    host: 'Anfitri\u00f3n',
    busser: 'Busboy',
    runner: 'Runner',
    cook: 'Cocinero',
    bartender: 'Bartender',
    knowledgeLeaderboard: 'Tabla de Conocimiento',
    thisMonth: 'Este mes',
    pts: 'pts',
    viewFullLeaderboard: 'Ver tabla completa \u2192',
    activeContest: 'Competencia Activa',
    prize: 'Premio',
    complete: 'completado',
    daysLeft: 'd\u00edas restantes',
    participants: 'participantes',
    aiInsight: 'IA Insight',
    aiInsightText:
      '3 nuevos empleados se est\u00e1n quedando atr\u00e1s en sus m\u00f3dulos de Server 101. Considera enviar un recordatorio o programar una revisi\u00f3n para ayudarlos a ponerse al d\u00eda antes de la Semana 3.',
    sendReminder: 'Enviar Recordatorio',
    dismiss: 'Descartar',
    week: 'Semana',
    of: 'de',

    // Courses view — hero banner
    active: 'Activos',
    completion: 'Finalizaci\u00f3n',
    avgGrade: 'Prom. Calificaci\u00f3n',
    newHireReq: 'Req. Nuevos',

    // Courses view — sidebar & detail
    searchCourses: 'Buscar cursos...',
    allCourses: 'Todos',
    newHireCourses: 'Nuevos',
    foh: 'FOH',
    boh: 'BOH',
    enrolled: 'Inscritos',
    completed: 'Completados',
    inProgress: 'En Progreso',
    notStarted: 'Sin Iniciar',
    modules: 'm\u00f3dulos',
    sections: 'secciones',
    overdue: 'Vencido',
    stuck: 'Detenido',
    failedQuiz: 'Quiz Reprobado',
    stalled: 'Estancado',
    selectCourse: 'Selecciona un curso',
    selectCourseDesc: 'Elige un curso del panel lateral para ver detalles.',

    // AI Hub — hero banner
    aiTrainingManager: 'Gerente de Capacitaci\u00f3n IA',
    aiHubSubtitle:
      'Tu asistente IA ejecuta programas de capacitaci\u00f3n, crea competencias, asigna cursos seg\u00fan antig\u00fcedad y mantiene a tu equipo creciendo \u2014 autom\u00e1ticamente. T\u00fa solo apruebas.',
    staffManaged: 'Personal Gestionado',
    activeCourses: 'Cursos Activos',
    contestsRunning: 'Competencias Activas',

    // AI Hub — weekly update
    weeklyManagerUpdate: 'Reporte Semanal del Gerente',
    weeklyUpdateDesc:
      'Nuevos empleados, avance de cursos, competencias y lo que viene \u2014 listo para tu reuni\u00f3n.',

    // AI Hub — suggestions
    aiSuggestions: 'Sugerencias IA',
    pending: 'pendientes',
    approve: 'Aprobar',
    edit: 'Editar',
    skip: 'Omitir',
    adjustReward: 'Ajustar Premio',
    sendNudge: 'Enviar Recordatorio',

    // AI Hub — contests
    activeContests: 'Competencias Activas',
    createContest: 'Crear Competencia',
    live: 'En Vivo',
    leading: 'L\u00edder',

    // AI Hub — growth paths
    growthPaths: 'Rutas de Crecimiento',
    aiManagedProgression: 'Progresi\u00f3n gestionada por IA',
    currentlyInTier: 'actualmente en este nivel',

    // AI Hub — what's next / rewards / ask
    whatsNext: 'Pr\u00f3ximos Pasos',
    generate12MonthPlan: 'Generar Plan de 12 Meses',
    rewardBank: 'Banco de Premios',
    manage: 'Gestionar',
    usedThisMonth: 'usados este mes',
    askAi: 'Preguntar IA',
    askAiPlaceholder: 'Pregunta a la IA... ej. "Crea un plan de competencias de 3 meses sobre vinos"',

    // Employee overlay — header
    backTo: 'Volver a',
    avgScore: 'Prom. Calificaci\u00f3n',
    grade: 'Calificaci\u00f3n',
    coursesDone: 'Cursos Completos',
    learnSpeedLabel: 'Vel. Aprendizaje',

    // Employee overlay — course detail
    aiAnalysis: 'An\u00e1lisis IA',
    moduleResults: 'Resultados por M\u00f3dulo',
    attemptHistory: 'HISTORIAL DE INTENTOS',
    struggleWith: 'Dificultad con',
    aiCourseSummary: 'Resumen IA del Curso',
    recommendation: 'Recomendaci\u00f3n',
    vsCohortAvg: 'vs. Promedio del Grupo',

    // Employee overlay — quick actions
    quickActions: 'Acciones R\u00e1pidas',
    schedule1on1: 'Agendar 1-a-1',
    sendResource: 'Enviar Recurso',
    nudge: 'Recordar',
    addNote: 'Agregar Nota',
    assignCourse: 'Asignar Curso',

    // Employee overlay — AI analysis tab
    snapshot: 'Resumen',
    strengths: 'Fortalezas',
    areasToDevelop: '\u00c1reas a Desarrollar',
    growthTrajectory: 'Trayectoria de Crecimiento',
    aiPrediction: 'Predicci\u00f3n IA',
    riskLevel: 'Nivel de Riesgo',
    potential: 'Potencial',
    attempts: 'intentos',
    attempt: 'intento',
    unlocks: 'Se desbloquea despu\u00e9s de',

    // Weekly update overlay
    backToAiHub: 'Volver a IA Hub',
    weeklyUpdate: 'Reporte Semanal',
    weekOf: 'Semana del',

    // Manager chat
    managerChatWelcome: 'Preg\u00fantame sobre la capacitaci\u00f3n de tu equipo',
    managerChatHint: 'Prueba: "\u00bfC\u00f3mo va mi equipo?" o "\u00bfQui\u00e9n necesita atenci\u00f3n?"',

    // AI Feedback / Evaluations
    aiFeedback: 'Retroalimentaci\u00f3n IA',
    noEvaluations: 'Sin evaluaciones a\u00fan',
    noEvaluationsHint: 'Las evaluaciones aparecer\u00e1n aqu\u00ed cuando los empleados completen las evaluaciones de capacitaci\u00f3n.',
    retry: 'Reintentar',

    // Notifications (Phase D)
    notifications: 'Notificaciones',
    noNotifications: 'No hay notificaciones',
    noNotificationsHint: 'Est\u00e1s al d\u00eda',

    // Notification types (Phase D)
    notificationAssignment: 'Nueva Asignaci\u00f3n',
    notificationNudge: 'Recordatorio de Entrenamiento',
    notificationReminder: 'Recordatorio',
    notificationAnnouncement: 'Anuncio',

    // Suggestion / action strings (Phase D)
    noPendingSuggestions: 'No hay sugerencias pendientes',
    noPendingSuggestionsHint: 'Las sugerencias de IA aparecer\u00e1n aqu\u00ed cuando est\u00e9n disponibles',
    approved: 'Aprobado',
    skipped: 'Omitido',
  },
} as const;

export type AdminStrings = (typeof ADMIN_STRINGS)['en'];
