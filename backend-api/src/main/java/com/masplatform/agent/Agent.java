package com.masplatform.agent;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "agents")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Agent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(nullable = false)
    private String provider;   // azure | databricks | openai | anthropic | gemini

    @Column(nullable = false)
    private String model;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> tools;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> skills;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> middleware;

    @Column(name = "memory_enabled", nullable = false)
    private boolean memoryEnabled = true;

    @Column(name = "run_mode", nullable = false)
    private String runMode = "interactive";   // interactive | background

    @Column(name = "max_run_duration_minutes", nullable = false)
    private int maxRunDurationMinutes = 30;

    @Column(name = "personalization_prompt", columnDefinition = "TEXT")
    private String personalizationPrompt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
