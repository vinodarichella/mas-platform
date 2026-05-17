package com.masplatform.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * Checks per-user rate limits before every /api/** request.
 * Returns HTTP 429 with a Retry-After header when a bucket is exhausted.
 */
@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitService rateLimitService;
    private final AppProperties    props;

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws IOException {

        if (!props.getRateLimit().isEnabled()) return true;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        // Let unauthenticated requests through — the security filter will reject them
        if (auth == null || !auth.isAuthenticated()
                || "anonymousUser".equals(auth.getPrincipal())) {
            return true;
        }

        String userId = auth.getName();
        boolean allowed = isChat(request)
                ? rateLimitService.tryConsumeChat(userId)
                : rateLimitService.tryConsumeGeneral(userId);

        if (!allowed) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"error\":\"Rate limit exceeded\",\"retryAfterSeconds\":60}");
            return false;
        }
        return true;
    }

    /** Chat endpoint: POST /api/sessions/{id}/chat or POST /api/agents/{id}/test */
    private boolean isChat(HttpServletRequest req) {
        if (!"POST".equalsIgnoreCase(req.getMethod())) return false;
        String uri = req.getRequestURI();
        return uri.matches(".*/api/sessions/[^/]+/chat")
                || uri.matches(".*/api/agents/[^/]+/test");
    }
}
