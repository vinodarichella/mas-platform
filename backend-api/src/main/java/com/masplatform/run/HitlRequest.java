package com.masplatform.run;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "hitl_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HitlRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> response;

    @Column(nullable = false)
    private String status;  // pending | responded | timeout

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = "pending";
    }
}
