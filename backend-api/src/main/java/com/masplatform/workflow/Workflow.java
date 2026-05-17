package com.masplatform.workflow;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "workflows")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Workflow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "orchestration_type", nullable = false)
    private String orchestrationType;   // sequential|concurrent|handoff|groupchat|magentic|declarative

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", columnDefinition = "jsonb")
    private Map<String, Object> graphJson;

    @Column(name = "yaml_content", columnDefinition = "TEXT")
    private String yamlContent;

    @Column(name = "is_template", nullable = false)
    private boolean isTemplate = false;

    @Column(name = "template_category")
    private String templateCategory;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
