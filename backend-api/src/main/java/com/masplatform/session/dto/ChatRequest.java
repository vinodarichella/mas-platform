package com.masplatform.session.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class ChatRequest {
    @NotBlank
    private String message;

    private UUID agentId;     // optional — uses session's default agent if null

    private boolean background; // true → long-running background job
}
