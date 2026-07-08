sed -i -e '/{viewMode === '"'"'detailed'"'"' && (/i\
        {lumiRecommendations \&\& lumiRecommendations.length > 0 \&\& (\
          <DailyPriorityCard \
            priority={lumiRecommendations[0].title}\
            impact={lumiRecommendations[0].impact === "high" ? "Alto" : "Médio"}\
            action={lumiRecommendations[0].actionText || "Resolver Agora"}\
            url={lumiRecommendations[0].actionUrl || "/"}\
          />\
        )}\
' src/pages/dashboard/DashboardHome.tsx
