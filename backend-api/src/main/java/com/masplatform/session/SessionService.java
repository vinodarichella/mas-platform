package com.masplatform.session;

import com.masplatform.session.dto.MessageDto;
import com.masplatform.session.dto.SessionDto;
import com.masplatform.user.User;
import com.masplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepo;
    private final MessageRepository messageRepo;
    private final UserRepository userRepo;

    public List<SessionDto> listSessions(UUID userId) {
        return sessionRepo.findByUserIdOrderByLastActiveAtDesc(userId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public SessionDto createSession(UUID userId, String name) {
        User user = userRepo.getReferenceById(userId);
        Session session = Session.builder()
                .user(user)
                .name(name != null && !name.isBlank() ? name : "New Session")
                .build();
        return toDto(sessionRepo.save(session));
    }

    public SessionDto getSession(UUID sessionId, UUID userId) {
        return sessionRepo.findByIdAndUserId(sessionId, userId)
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void deleteSession(UUID sessionId, UUID userId) {
        Session session = sessionRepo.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        sessionRepo.delete(session);
    }

    @Transactional
    public void touchSession(UUID sessionId) {
        sessionRepo.findById(sessionId).ifPresent(s -> {
            s.setLastActiveAt(Instant.now());
            sessionRepo.save(s);
        });
    }

    public List<MessageDto> getMessages(UUID sessionId, UUID userId) {
        sessionRepo.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return messageRepo.findBySessionIdOrderBySequenceIdAsc(sessionId)
                .stream().map(this::toMessageDto).toList();
    }

    @Transactional
    public Message saveMessage(UUID sessionId, UUID runId, String role, String content) {
        long nextSeq = messageRepo.maxSequenceId(sessionId) + 1;
        Message msg = Message.builder()
                .sessionId(sessionId)
                .runId(runId)
                .role(role)
                .content(content)
                .sequenceId(nextSeq)
                .build();
        return messageRepo.save(msg);
    }

    /** Last N messages as plain maps — sent to the Python engine as history. */
    public List<java.util.Map<String, String>> getHistoryForEngine(UUID sessionId, int limit) {
        return messageRepo.findLastN(sessionId, limit).stream()
                .sorted(java.util.Comparator.comparingLong(Message::getSequenceId))
                .map(m -> java.util.Map.of("role", m.getRole(), "content", m.getContent()))
                .toList();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private SessionDto toDto(Session s) {
        return SessionDto.builder()
                .id(s.getId())
                .name(s.getName())
                .workflowId(s.getWorkflowId())
                .createdAt(s.getCreatedAt())
                .lastActiveAt(s.getLastActiveAt())
                .build();
    }

    private MessageDto toMessageDto(Message m) {
        return MessageDto.builder()
                .id(m.getId())
                .role(m.getRole())
                .content(m.getContent())
                .metadata(m.getMetadata())
                .sequenceId(m.getSequenceId())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
