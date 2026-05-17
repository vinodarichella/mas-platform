package com.masplatform.run;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "runs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Run {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "workflow_id")
    private UUID workflowId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String status;   // queued | running | paused_hitl | completed | failed | cancelled

    @Column(name = "job_type", nullable = false)
    private String jobType;  // interactive | background

    @Column(name = "last_event_seq", nullable = false)
    private Long lastEventSeq;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_data", columnDefinition = "jsonb")
    private Map<String, Object> inputData;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_data", columnDefinition = "jsonb")
    private Map<String, Object> outputData;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @PrePersist
    void prePersist() {
        if (startedAt == null) startedAt = Instant.now();
        if (lastEventSeq == null) lastEventSeq = 0L;
        if (status == null) status = "queued";
        if (jobType == null) jobType = "interactive";
    }
}
