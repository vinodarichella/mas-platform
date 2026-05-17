package com.masplatform.auth;

import com.masplatform.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        // Primary: Authorization header (all regular API calls)
        // Fallback: ?token= query param — needed for SSE (browser EventSource can't set headers)
        String header = request.getHeader("Authorization");
        String token;
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7);
        } else {
            String queryToken = request.getParameter("token");
            if (queryToken == null || queryToken.isBlank()) {
                chain.doFilter(request, response);
                return;
            }
            token = queryToken;
        }
        if (!jwtUtil.isValid(token)) {
            chain.doFilter(request, response);
            return;
        }

        UUID userId = jwtUtil.extractUserId(token);
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            userRepository.findById(userId).ifPresent(u -> {
                var principal = User.withUsername(u.getId().toString())
                        .password("")
                        .authorities(List.of())
                        .build();
                var auth = new UsernamePasswordAuthenticationToken(
                        principal, null, principal.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }

        chain.doFilter(request, response);
    }
}
