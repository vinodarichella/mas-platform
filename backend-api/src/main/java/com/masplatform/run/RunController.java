package com.masplatform.run;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/runs")
@RequiredArgsConstructor
@Slf4j
public class RunController {

    private static final Set<String> TERMINAL_EVENTS =
            Set.of("completed", "error", "cancelled");

    private final RunRepository         runRepo;
    private final RunEventRepository    runEventRepo;
    private final HitlRequestRepository hitlRepo;
    private final ObjectMapper          objectMapper;

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    @GetMapping
    public List<Run> listRuns(@AuthenticationPrincipal UserDetails user) {
        return runRepo.findByUserIdOrderByStartedAtDesc(UUID.fromString(user.getUsername()));
    }

    @GetMapping("/{runId}")
    public ResponseEntity<Run> getRun(@PathVariable UUID runId,
                                      @AuthenticationPrincipal UserDetails user) {
        return runRepo.findByIdAndUserId(runId, UUID.fromString(user.getUsername()))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * SSE stream for a run.
     * Phase 1: replay all missed events from Last-Event-ID (or 0).
     * Phase 2: poll every 400 ms for new events until a terminal event is seen.
     * Token accepted via ?token= query param because browser EventSource can't set headers.
     */
    @GetMapping(value = "/{runId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamRun(
            @PathVariable UUID runId,
            @RequestHeader(value = "Last-Event-ID", required = false) Long lastEventId) {

        SseEmitter emitter = new SseEmitter(300_000L);

        executor.submit(() -> {
            long lastSeq = lastEventId != null ? lastEventId : 0L;

            try {
                // Phase 1: replay missed events
                List<RunEvent> replayed = runEventRepo
                        .findByRunIdAndSequenceIdGreaterThanOrderBySequenceIdAsc(runId, lastSeq);
                for (RunEvent ev : replayed) {
                    emitter.send(toSseEvent(ev));
                    lastSeq = ev.getSequenceId();
                    if (TERMINAL_EVENTS.contains(ev.getEventType())) {
                        emitter.complete();
                        return;
                    }
                }

                // Phase 2: tail new events (poll every 400 ms)
                long currentSeq = lastSeq;
                while (true) {
                    Thread.sleep(400);
                    List<RunEvent> newEvents = runEventRepo
                            .findByRunIdAndSequenceIdGreaterThanOrderBySequenceIdAsc(runId, currentSeq);
                    for (RunEvent ev : newEvents) {
                        emitter.send(toSseEvent(ev));
                        currentSeq = ev.getSequenceId();
                        if (TERMINAL_EVENTS.contains(ev.getEventType())) {
                            emitter.complete();
                            return;
                        }
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                emitter.complete();
            } catch (IOException e) {
                log.debug("SSE client disconnected for run {}", runId);
            } catch (Exception e) {
                log.error("SSE error for run {}: {}", runId, e.getMessage());
                emitter.completeWithError(e);
            }
        });

        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> log.debug("SSE emitter error: {}", e.getMessage()));

        return emitter;
    }

    /**
     * HITL response — stores in hitl_requests table.
     * The Python engine polls this table and resumes when it finds a response.
     */
    @PostMapping("/{runId}/hitl")
    public ResponseEntity<Map<String, String>> submitHitl(
            @PathVariable UUID runId,
            @RequestBody Map<String, Object> body) {

        String hitlId = (String) body.get("hitlId");
        if (hitlId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "hitlId required"));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> response = body.containsKey("response")
                ? (Map<String, Object>) body.get("response")
                : Map.of("text", body.getOrDefault("text", ""));

        hitlRepo.findById(UUID.fromString(hitlId)).ifPresent(hr -> {
            hr.setResponse(response);
            hr.setStatus("responded");
            hr.setRespondedAt(Instant.now());
            hitlRepo.save(hr);
        });

        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/{runId}/cancel")
    public ResponseEntity<Map<String, String>> cancelRun(
            @PathVariable UUID runId,
            @AuthenticationPrincipal UserDetails user) {
        runRepo.findByIdAndUserId(runId, UUID.fromString(user.getUsername())).ifPresent(r -> {
            r.setStatus("cancelled");
            runRepo.save(r);
        });
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private SseEmitter.SseEventBuilder toSseEvent(RunEvent ev) throws Exception {
        return SseEmitter.event()
                .id(ev.getSequenceId().toString())
                .name(ev.getEventType())
                .data(objectMapper.writeValueAsString(ev.getPayload()));
    }
}
