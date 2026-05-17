package com.masplatform.session;

import com.masplatform.agent.AgentRepository;
import com.masplatform.agent.AgentService;
import com.masplatform.agent.dto.AgentDto;
import com.masplatform.config.AppProperties;
import com.masplatform.run.Run;
import com.masplatform.run.RunEvent;
import com.masplatform.run.RunEventRepository;
import com.masplatform.run.RunRepository;
import com.masplatform.session.dto.ChatRequest;
import com.masplatform.session.dto.ChatResponse;
import com.masplatform.user.User;
import com.masplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final SessionService      sessionService;
    private final RunRepository       runRepo;
    private final RunEventRepository  runEventRepo;
    private final UserRepository      userRepo;
    private final AgentRepository     agentRepo;
    private final AgentService        agentService;
    private final AppProperties       props;

    // ── Interactive session chat ───────────────────────────────────────────────

    @Transactional
    public ChatResponse startChat(UUID sessionId, UUID userId, ChatRequest req) {
        Message userMsg = sessionService.saveMessage(sessionId, null, "user", req.getMessage());
        sessionService.touchSession(sessionId);

        String jobType = req.isBackground() ? "background" : "interactive";

        Run run = runRepo.save(Run.builder()
                .sessionId(sessionId)
                .userId(userId)
                .status("queued")
                .jobType(jobType)
                .inputData(Map.of("message", req.getMessage()))
                .build());

        userMsg.setRunId(run.getId());

        List<Map<String, String>> history = sessionService.getHistoryForEngine(sessionId, 20);
        User user = userRepo.findById(userId).orElseThrow();
        Map<String, Object> prefs = user.getPreferences() != null ? user.getPreferences() : Map.of();
        Map<String, Object> agentConfig = resolveAgentConfig(req.getAgentId(), userId);

        // Max duration: use agent config if available, else default
        int maxMinutes = resolveMaxDuration(agentConfig, req.isBackground());

        Map<String, Object> payload = buildPayload(
                run.getId(), sessionId, userId, req.getMessage(),
                agentConfig, history, prefs, jobType
        );

        if (req.isBackground()) {
            fireBackgroundJob(run.getId(), sessionId, payload, maxMinutes);
        } else {
            fireEngine(run.getId(), sessionId, payload, maxMinutes);
        }

        return ChatResponse.builder()
                .runId(run.getId())
                .messageId(userMsg.getId())
                .status("running")
                .build();
    }

    // ── Agent test (no session) ────────────────────────────────────────────────

    @Transactional
    public ChatResponse startAgentTest(UUID userId, AgentDto agent, String message) {
        Run run = runRepo.save(Run.builder()
                .userId(userId)
                .status("queued")
                .jobType("interactive")
                .inputData(Map.of("message", message))
                .build());

        User user = userRepo.findById(userId).orElseThrow();
        Map<String, Object> prefs = user.getPreferences() != null ? user.getPreferences() : Map.of();
        Map<String, Object> agentConfig = agentDtoToEngineConfig(agent);

        Map<String, Object> payload = buildPayload(
                run.getId(), null, userId, message,
                agentConfig, List.of(), prefs, "interactive"
        );

        fireEngine(run.getId(), null, payload, 30);

        return ChatResponse.builder()
                .runId(run.getId())
                .status("running")
                .build();
    }

    // ── Async engine calls ────────────────────────────────────────────────────

    /** POST to /execute (interactive). Blocks the virtual thread until the run completes. */
    @Async
    public void fireEngine(UUID runId, UUID sessionId, Map<String, Object> payload, int maxMinutes) {
        RestTemplate rest = new RestTemplate();
        HttpHeaders headers = engineHeaders();
        String url = props.getExecutionEngine().getUrl() + "/execute";

        try {
            runRepo.findById(runId).ifPresent(r -> { r.setStatus("running"); runRepo.save(r); });
            rest.exchange(url, HttpMethod.POST, new HttpEntity<>(payload, headers), Map.class);
            waitForCompletionAndSaveResponse(runId, sessionId, maxMinutes);
        } catch (Exception e) {
            log.error("Engine call failed for run {}: {}", runId, e.getMessage());
            failRun(runId, e.getMessage());
        }
    }

    /** POST to /jobs (background). Returns immediately; Python handles timeout. */
    @Async
    public void fireBackgroundJob(UUID runId, UUID sessionId, Map<String, Object> payload, int maxMinutes) {
        RestTemplate rest = new RestTemplate();
        HttpHeaders headers = engineHeaders();
        String url = props.getExecutionEngine().getUrl() + "/jobs";

        // Build background-specific payload (add max_duration_minutes)
        Map<String, Object> jobPayload = new LinkedHashMap<>(payload);
        jobPayload.put("max_duration_minutes", maxMinutes);

        try {
            runRepo.findById(runId).ifPresent(r -> { r.setStatus("running"); runRepo.save(r); });
            rest.exchange(url, HttpMethod.POST, new HttpEntity<>(jobPayload, headers), Map.class);
            // For background jobs, wait up to maxMinutes for completion to persist the message
            waitForCompletionAndSaveResponse(runId, sessionId, maxMinutes);
        } catch (Exception e) {
            log.error("Background job call failed for run {}: {}", runId, e.getMessage());
            failRun(runId, e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private HttpHeaders engineHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("X-Internal-Key", props.getExecutionEngine().getInternalApiKey());
        return h;
    }

    private Map<String, Object> resolveAgentConfig(UUID agentId, UUID userId) {
        if (agentId != null) {
            return agentRepo.findByIdAndUserId(agentId, userId)
                    .map(agentService::toEngineConfig)
                    .orElse(defaultAgentConfig());
        }
        return defaultAgentConfig();
    }

    private int resolveMaxDuration(Map<String, Object> agentConfig, boolean background) {
        Object raw = agentConfig.get("max_run_duration_minutes");
        if (raw instanceof Number n) return n.intValue();
        return background ? 480 : 30;
    }

    private Map<String, Object> agentDtoToEngineConfig(AgentDto dto) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("id",                       dto.getId().toString());
        config.put("name",                     dto.getName());
        config.put("instructions",             dto.getInstructions() != null ? dto.getInstructions() : "You are a helpful assistant.");
        config.put("provider",                 dto.getProvider());
        config.put("model",                    dto.getModel());
        config.put("tools",                    dto.getTools() != null ? dto.getTools() : List.of());
        config.put("skills",                   dto.getSkills() != null ? dto.getSkills() : List.of());
        config.put("memory_enabled",           dto.isMemoryEnabled());
        config.put("run_mode",                 dto.getRunMode());
        config.put("max_run_duration_minutes", dto.getMaxRunDurationMinutes());
        config.put("personalization_prompt",   dto.getPersonalizationPrompt());
        return config;
    }

    private Map<String, Object> defaultAgentConfig() {
        return Map.of(
                "id",           "default",
                "name",         "assistant",
                "provider",     "azure",
                "model",        "gpt-4o",
                "instructions", "You are a helpful AI assistant.",
                "tools",        List.of(),
                "max_run_duration_minutes", 30
        );
    }

    private Map<String, Object> buildPayload(
            UUID runId, UUID sessionId, UUID userId, String message,
            Map<String, Object> agentConfig,
            List<Map<String, String>> history,
            Map<String, Object> prefs,
            String jobType) {

        Map<String, Object> workflowConfig = Map.of(
                "id",                 UUID.randomUUID().toString(),
                "name",               "chat",
                "orchestration_type", "sequential",
                "agents",             List.of(Map.of("ref", agentConfig.get("id"), "alias", "assistant")),
                "yaml_content",       ""
        );

        return Map.of(
                "run_id",               runId.toString(),
                "workflow_id",          "",
                "user_id",              userId.toString(),
                "session_id",           sessionId != null ? sessionId.toString() : "",
                "workflow_config",      workflowConfig,
                "agent_configs",        List.of(agentConfig),
                "inputs",               Map.of("message", message),
                "conversation_history", history,
                "user_memory",          List.of(),
                "user_preferences",     prefs,
                "job_type",             jobType
        );
    }

    /**
     * Polls run_events until a terminal event is seen, then persists
     * the agent reply as a session message.
     */
    private void waitForCompletionAndSaveResponse(UUID runId, UUID sessionId, int maxMinutes) {
        long deadline    = System.currentTimeMillis() + (long) maxMinutes * 60 * 1000;
        String agentText = null;
        String finalStatus = "completed";

        while (System.currentTimeMillis() < deadline) {
            try { Thread.sleep(500); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            List<RunEvent> events = runEventRepo.findByRunIdOrderBySequenceIdAsc(runId);
            for (RunEvent ev : events) {
                if ("agent_message".equals(ev.getEventType())) {
                    Object c = ev.getPayload().get("content");
                    if (c != null) agentText = c.toString();
                }
                String et = ev.getEventType();
                if ("completed".equals(et) || "error".equals(et) || "cancelled".equals(et)) {
                    if ("error".equals(et))     finalStatus = "failed";
                    if ("cancelled".equals(et)) finalStatus = "cancelled";

                    if (agentText != null && sessionId != null) {
                        sessionService.saveMessage(sessionId, runId, "agent", agentText);
                    }
                    String fs = finalStatus;
                    runRepo.findById(runId).ifPresent(r -> { r.setStatus(fs); runRepo.save(r); });
                    return;
                }
            }
        }
        // Deadline exceeded — mark timed out
        log.warn("Run {} exceeded max duration of {} minutes", runId, maxMinutes);
        failRun(runId, "Max run duration exceeded (" + maxMinutes + " minutes)");
    }

    private void failRun(UUID runId, String message) {
        runRepo.findById(runId).ifPresent(r -> {
            r.setStatus("failed");
            r.setErrorMessage(message);
            runRepo.save(r);
        });
        try {
            runEventRepo.save(RunEvent.builder()
                    .runId(runId).sequenceId(999L)
                    .eventType("error")
                    .payload(Map.of("message", message))
                    .build());
        } catch (Exception ex) {
            log.error("Could not write error event for run {}: {}", runId, ex.getMessage());
        }
    }
}
