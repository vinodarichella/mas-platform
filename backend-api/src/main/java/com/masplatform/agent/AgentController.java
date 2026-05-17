package com.masplatform.agent;

import com.masplatform.agent.dto.AgentDto;
import com.masplatform.agent.dto.AgentRequest;
import com.masplatform.session.ChatService;
import com.masplatform.session.dto.ChatRequest;
import com.masplatform.session.dto.ChatResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final ChatService  chatService;

    @GetMapping
    public List<AgentDto> list(@AuthenticationPrincipal UserDetails user) {
        return agentService.list(UUID.fromString(user.getUsername()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AgentDto create(@AuthenticationPrincipal UserDetails user,
                           @Valid @RequestBody AgentRequest req) {
        return agentService.create(UUID.fromString(user.getUsername()), req);
    }

    @GetMapping("/{id}")
    public AgentDto get(@PathVariable UUID id,
                        @AuthenticationPrincipal UserDetails user) {
        return agentService.get(id, UUID.fromString(user.getUsername()));
    }

    @PutMapping("/{id}")
    public AgentDto update(@PathVariable UUID id,
                           @AuthenticationPrincipal UserDetails user,
                           @Valid @RequestBody AgentRequest req) {
        return agentService.update(id, UUID.fromString(user.getUsername()), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id,
                       @AuthenticationPrincipal UserDetails user) {
        agentService.delete(id, UUID.fromString(user.getUsername()));
    }

    /** Returns configured + all available providers/models for the UI dropdowns. */
    @GetMapping("/providers")
    public Map<String, Object> providers() {
        return agentService.getProviders();
    }

    /**
     * One-shot agent test from the editor panel.
     * Creates a temporary session-less run so the editor can test inline.
     * React streams events via /api/runs/{runId}/stream.
     */
    @PostMapping("/{id}/test")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ChatResponse testAgent(@PathVariable UUID id,
                                   @AuthenticationPrincipal UserDetails user,
                                   @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(user.getUsername());
        AgentDto agent = agentService.get(id, userId);
        String message = body.getOrDefault("message", "Hello");

        ChatRequest req = new ChatRequest();
        req.setMessage(message);
        req.setAgentId(id);

        return chatService.startAgentTest(userId, agent, message);
    }
}
