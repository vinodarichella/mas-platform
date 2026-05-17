package com.masplatform.session.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data @Builder
public class ChatResponse {
    private UUID runId;
    private UUID messageId;   // the saved user message
    private String status;    // running | queued
}
