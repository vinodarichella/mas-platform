package com.masplatform.agent;

import com.masplatform.agent.dto.AgentDto;
import com.masplatform.agent.dto.AgentRequest;
import com.masplatform.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final AgentRepository agentRepo;
    private final AppProperties   props;

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public List<AgentDto> list(UUID userId) {
        return agentRepo.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public AgentDto create(UUID userId, AgentRequest req) {
        validateRequest(req, userId, null);
        Agent agent = buildEntity(req, userId);
        return toDto(agentRepo.save(agent));
    }

    public AgentDto get(UUID agentId, UUID userId) {
        return agentRepo.findByIdAndUserId(agentId, userId)
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Transactional
    public AgentDto update(UUID agentId, UUID userId, AgentRequest req) {
        Agent agent = agentRepo.findByIdAndUserId(agentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        validateRequest(req, userId, agentId);
        applyRequest(agent, req);
        return toDto(agentRepo.save(agent));
    }

    @Transactional
    public void delete(UUID agentId, UUID userId) {
        Agent agent = agentRepo.findByIdAndUserId(agentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        agentRepo.delete(agent);
    }

    /** Convert an Agent entity to the plain map the Python engine expects. */
    public Map<String, Object> toEngineConfig(Agent agent) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("id",           agent.getId().toString());
        config.put("name",         agent.getName());
        config.put("instructions", agent.getInstructions() != null ? agent.getInstructions() : "You are a helpful assistant.");
        config.put("provider",     agent.getProvider());
        config.put("model",        agent.getModel());
        config.put("tools",        agent.getTools() != null ? agent.getTools() : List.of());
        config.put("skills",       agent.getSkills() != null ? agent.getSkills() : List.of());
        config.put("memory_enabled",              agent.isMemoryEnabled());
        config.put("run_mode",                    agent.getRunMode());
        config.put("max_run_duration_minutes",    agent.getMaxRunDurationMinutes());
        config.put("personalization_prompt",      agent.getPersonalizationPrompt());
        return config;
    }

    // ── Provider/model discovery (proxied from Python engine) ─────────────────

    public Map<String, Object> getProviders() {
        try {
            RestTemplate rest = new RestTemplate();
            String url = props.getExecutionEngine().getUrl() + "/agents/providers";
            @SuppressWarnings("unchecked")
            Map<String, Object> result = rest.getForObject(url, Map.class);
            return result != null ? result : defaultProviders();
        } catch (Exception e) {
            log.warn("Could not reach execution engine for providers, using defaults: {}", e.getMessage());
            return defaultProviders();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validateRequest(AgentRequest req, UUID userId, UUID excludeId) {
        boolean nameTaken = agentRepo.existsByNameAndUserId(req.getName(), userId);
        if (nameTaken && excludeId == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Agent name already in use");
        }
        List<String> allowed = List.of("azure", "databricks", "openai", "anthropic", "gemini");
        if (!allowed.contains(req.getProvider())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported provider: " + req.getProvider());
        }
        List<String> allowedModes = List.of("interactive", "background");
        if (!allowedModes.contains(req.getRunMode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "runMode must be one of: " + allowedModes);
        }
    }

    private Agent buildEntity(AgentRequest req, UUID userId) {
        return Agent.builder()
                .userId(userId)
                .name(req.getName())
                .instructions(req.getInstructions())
                .provider(req.getProvider())
                .model(req.getModel())
                .tools(req.getTools())
                .skills(req.getSkills())
                .middleware(req.getMiddleware())
                .memoryEnabled(req.isMemoryEnabled())
                .runMode(req.getRunMode())
                .maxRunDurationMinutes(req.getMaxRunDurationMinutes())
                .personalizationPrompt(req.getPersonalizationPrompt())
                .build();
    }

    private void applyRequest(Agent agent, AgentRequest req) {
        agent.setName(req.getName());
        agent.setInstructions(req.getInstructions());
        agent.setProvider(req.getProvider());
        agent.setModel(req.getModel());
        agent.setTools(req.getTools());
        agent.setSkills(req.getSkills());
        agent.setMiddleware(req.getMiddleware());
        agent.setMemoryEnabled(req.isMemoryEnabled());
        agent.setRunMode(req.getRunMode());
        agent.setMaxRunDurationMinutes(req.getMaxRunDurationMinutes());
        agent.setPersonalizationPrompt(req.getPersonalizationPrompt());
    }

    private AgentDto toDto(Agent a) {
        return AgentDto.builder()
                .id(a.getId())
                .name(a.getName())
                .instructions(a.getInstructions())
                .provider(a.getProvider())
                .model(a.getModel())
                .tools(a.getTools())
                .skills(a.getSkills())
                .middleware(a.getMiddleware())
                .memoryEnabled(a.isMemoryEnabled())
                .runMode(a.getRunMode())
                .maxRunDurationMinutes(a.getMaxRunDurationMinutes())
                .personalizationPrompt(a.getPersonalizationPrompt())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }

    private Map<String, Object> defaultProviders() {
        return Map.of(
                "configured", Map.of(),
                "all", Map.of(
                        "azure",       List.of("gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-35-turbo"),
                        "databricks",  List.of("databricks-meta-llama-3-3-70b-instruct",
                                               "databricks-meta-llama-3-1-405b-instruct",
                                               "databricks-dbrx-instruct"),
                        "openai",      List.of("gpt-4o", "gpt-4o-mini"),
                        "anthropic",   List.of("claude-sonnet-4-6", "claude-opus-4-7"),
                        "gemini",      List.of("gemini-2.0-flash", "gemini-1.5-pro")
                )
        );
    }
}
