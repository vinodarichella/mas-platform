package com.masplatform.session.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data @Builder
public class SessionDto {
    private UUID id;
    private String name;
    private UUID workflowId;
    private Instant createdAt;
    private Instant lastActiveAt;
}
