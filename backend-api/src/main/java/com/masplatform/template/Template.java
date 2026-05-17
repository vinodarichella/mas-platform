package com.masplatform.template;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "templates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Template {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column
    private String category;

    @Column(name = "orchestration_type", nullable = false)
    private String orchestrationType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_json", columnDefinition = "jsonb")
    private Map<String, Object> graphJson;

    @Column(name = "yaml_content", columnDefinition = "TEXT")
    private String yamlContent;

    @Column(name = "thumbnail_url")
    private String thumbnailUrl;

    @Column(name = "is_builtin", nullable = false)
    private boolean isBuiltin = false;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { createdAt = Instant.now(); }
}
