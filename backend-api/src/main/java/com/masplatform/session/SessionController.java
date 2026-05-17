package com.masplatform.session;

import com.masplatform.session.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;
    private final ChatService    chatService;

    @GetMapping
    public List<SessionDto> listSessions(@AuthenticationPrincipal UserDetails user) {
        return sessionService.listSessions(UUID.fromString(user.getUsername()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto createSession(@AuthenticationPrincipal UserDetails user,
                                    @RequestBody(required = false) Map<String, String> body) {
        String name = body != null ? body.get("name") : null;
        return sessionService.createSession(UUID.fromString(user.getUsername()), name);
    }

    @GetMapping("/{id}")
    public SessionDto getSession(@PathVariable UUID id,
                                  @AuthenticationPrincipal UserDetails user) {
        return sessionService.getSession(id, UUID.fromString(user.getUsername()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@PathVariable UUID id,
                               @AuthenticationPrincipal UserDetails user) {
        sessionService.deleteSession(id, UUID.fromString(user.getUsername()));
    }

    @GetMapping("/{id}/messages")
    public List<MessageDto> getMessages(@PathVariable UUID id,
                                         @AuthenticationPrincipal UserDetails user) {
        return sessionService.getMessages(id, UUID.fromString(user.getUsername()));
    }

    /** Send a chat message — returns run_id; React streams events via /api/runs/{runId}/stream */
    @PostMapping("/{id}/chat")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ChatResponse chat(@PathVariable UUID id,
                              @AuthenticationPrincipal UserDetails user,
                              @Valid @RequestBody ChatRequest req) {
        return chatService.startChat(id, UUID.fromString(user.getUsername()), req);
    }
}
