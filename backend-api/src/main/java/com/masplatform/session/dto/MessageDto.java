package com.masplatform.session.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data @Builder
public class MessageDto {
    private UUID id;
    private String role;
    private String content;
    private Map<String, Object> metadata;
    private Long sequenceId;
    private Instant createdAt;
}
